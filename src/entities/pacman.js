import { Direction, DELTA, TILE_SIZE, PACMAN_SPEED } from "../constants.js";
import { neighborTile, tileCenterPx, consumeDot } from "../maze.js";

export class PacMan {
  constructor(startTile) {
    this.startTile = startTile;
    this.reset();
  }

  reset() {
    this.col = this.startTile.col;
    this.row = this.startTile.row;
    this.progress = 0;
    this.direction = Direction.LEFT;
    this.bufferedDirection = Direction.LEFT;
    this.mouthPhase = 0;
    this.alive = true;
  }

  get tile() {
    return { col: this.col, row: this.row };
  }

  // 렌더링용 픽셀 중심 좌표: 현재 타일에서 진행 방향으로 progress(0~1)만큼 보간.
  get pixelPosition() {
    const base = tileCenterPx(this.col, this.row);
    const d = DELTA[this.direction];
    return {
      x: base.x + d.col * this.progress * TILE_SIZE,
      y: base.y + d.row * this.progress * TILE_SIZE,
    };
  }

  setInputDirection(direction) {
    if (direction && direction !== Direction.NONE) {
      this.bufferedDirection = direction;
    }
  }

  update(dt, maze) {
    this.mouthPhase += dt;

    // 막혀서 정지한 상태라면 버퍼 방향이 열렸는지 매 틱 재시도.
    if (this.direction === Direction.NONE) {
      if (neighborTile(maze, this.col, this.row, this.bufferedDirection)) {
        this.direction = this.bufferedDirection;
      } else {
        return;
      }
    }

    const step = (PACMAN_SPEED * dt) / TILE_SIZE;
    this.progress += step;

    while (this.progress >= 1) {
      const landing = neighborTile(maze, this.col, this.row, this.direction);
      this.col = landing.col;
      this.row = landing.row;
      this.progress -= 1;

      // 교차로: 버퍼 방향 우선 시도 → 막히면 직진 유지 → 그것도 막히면 정지.
      if (neighborTile(maze, this.col, this.row, this.bufferedDirection)) {
        this.direction = this.bufferedDirection;
      } else if (!neighborTile(maze, this.col, this.row, this.direction)) {
        this.direction = Direction.NONE;
        this.progress = 0;
        break;
      }
    }
  }

  // 현재 타일의 dot/pellet 섭취 시도 — "dot" | "pellet" | null.
  eatAt(maze) {
    return consumeDot(maze, this.col, this.row);
  }
}
