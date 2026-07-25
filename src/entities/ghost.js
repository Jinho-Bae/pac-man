import {
  Direction,
  DELTA,
  OPPOSITE,
  TILE_SIZE,
  DIRECTION_PRIORITY,
  GhostState,
  GHOST_SPEED_RATIO,
  ghostSpeedForLevel,
  HOUSE_RELEASE_DELAY_SEC,
  COLORS,
} from "../constants.js";
import { neighborTile, availableDirections, tileCenterPx, tileDistance } from "../maze.js";
import { GHOST_START, SCATTER_CORNER, HOUSE_EXIT_TILE, HOUSE_CENTER_TILE } from "../maze-data.js";
import { TARGET_TILE_FN } from "./ghost-targeting.js";

// 타일 중심에서 방향이 여러 개 후보일 때, target까지 거리를 최소화하는 방향을 고른다.
// 동률이면 DIRECTION_PRIORITY(Up>Left>Down>Right) 순서로 먼저 나오는 후보가 이긴다. (PLAN §6, [확인필요])
function bestDirection(candidates, col, row, target) {
  let best = candidates[0];
  let bestDist = Infinity;
  for (const dir of DIRECTION_PRIORITY) {
    if (!candidates.includes(dir)) continue;
    const d = DELTA[dir];
    const dist = tileDistance({ col: col + d.col, row: row + d.row }, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

export class Ghost {
  constructor(name) {
    this.name = name;
    this.color = COLORS.ghosts[name];
    this.scatterCorner = SCATTER_CORNER[name];
    this.startTile = GHOST_START[name];
    this.reset();
  }

  reset() {
    this.col = this.startTile.col;
    this.row = this.startTile.row;
    this.progress = 0;
    this.direction = Direction.UP;
    this.state = GhostState.IN_HOUSE;
    this.houseTimer = 0;
  }

  get tile() {
    return { col: this.col, row: this.row };
  }

  get pixelPosition() {
    const base = tileCenterPx(this.col, this.row);
    const d = DELTA[this.direction];
    return {
      x: base.x + d.col * this.progress * TILE_SIZE,
      y: base.y + d.row * this.progress * TILE_SIZE,
    };
  }

  speedRatioFor(state) {
    if (state === GhostState.IN_HOUSE || state === GhostState.LEAVING_HOUSE) return GHOST_SPEED_RATIO.IN_HOUSE;
    if (state === GhostState.EATEN) return GHOST_SPEED_RATIO.EATEN;
    if (state === GhostState.FRIGHTENED) return GHOST_SPEED_RATIO.FRIGHTENED;
    return GHOST_SPEED_RATIO.CHASE; // SCATTER/CHASE 동일
  }

  // 위치는 그대로 두고 진행 방향만 즉시 뒤집는다 — 다음 타일 중심을 기다리지 않음.
  // 전역 scatter/chase 전환, frightened 진입 시 호출 (PLAN §6 "강제 방향 반전").
  reverseDirection(maze) {
    if (this.direction === Direction.NONE) return;
    const ahead = neighborTile(maze, this.col, this.row, this.direction);
    if (!ahead) return;
    this.col = ahead.col;
    this.row = ahead.row;
    this.direction = OPPOSITE[this.direction];
    this.progress = 1 - this.progress;
  }

  enterFrightened(maze) {
    if (this.state === GhostState.SCATTER || this.state === GhostState.CHASE) {
      this.reverseDirection(maze);
      this.state = GhostState.FRIGHTENED;
    }
  }

  exitFrightened(globalMode) {
    if (this.state === GhostState.FRIGHTENED) {
      this.state = globalMode;
    }
  }

  getEaten() {
    if (this.state === GhostState.FRIGHTENED) {
      this.state = GhostState.EATEN;
    }
  }

  update(dt, ctx) {
    const { maze, level } = ctx;

    if (this.state === GhostState.IN_HOUSE) {
      this.houseTimer += dt;
      if (this.houseTimer >= HOUSE_RELEASE_DELAY_SEC[this.name]) {
        this.state = GhostState.LEAVING_HOUSE;
        this.direction = this.chooseDirection(maze, ctx); // 시작 위치 기준 안전한 방향 확정
      }
      return;
    }

    const speed = ghostSpeedForLevel(level, this.speedRatioFor(this.state));
    const step = (speed * dt) / TILE_SIZE;
    this.progress += step;

    while (this.progress >= 1) {
      const landing = neighborTile(maze, this.col, this.row, this.direction);
      this.col = landing.col;
      this.row = landing.row;
      this.progress -= 1;

      if (this.state === GhostState.LEAVING_HOUSE && this.col === HOUSE_EXIT_TILE.col && this.row === HOUSE_EXIT_TILE.row) {
        // frightened가 아직 진행 중이면(막 하우스를 나서는 순간에도) 다른 고스트들과 함께 도주 상태로.
        this.state = ctx.frightenedActive ? GhostState.FRIGHTENED : ctx.currentGlobalMode;
      } else if (this.state === GhostState.EATEN && this.col === HOUSE_CENTER_TILE.col && this.row === HOUSE_CENTER_TILE.row) {
        this.state = GhostState.LEAVING_HOUSE;
      }

      this.direction = this.chooseDirection(maze, ctx);
    }
  }

  chooseDirection(maze, ctx) {
    const reverse = OPPOSITE[this.direction];
    let candidates = availableDirections(maze, this.col, this.row, reverse);
    if (candidates.length === 0) {
      candidates = availableDirections(maze, this.col, this.row, null); // 막다른 길: 역방향 허용
    }

    if (this.state === GhostState.FRIGHTENED) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    const target = this.targetTile(ctx);
    return bestDirection(candidates, this.col, this.row, target);
  }

  targetTile(ctx) {
    if (this.state === GhostState.SCATTER) return this.scatterCorner;
    if (this.state === GhostState.EATEN) return HOUSE_CENTER_TILE;
    if (this.state === GhostState.LEAVING_HOUSE) return HOUSE_EXIT_TILE;
    return TARGET_TILE_FN[this.name]({ pacman: ctx.pacman, ghosts: ctx.ghosts, self: this });
  }
}
