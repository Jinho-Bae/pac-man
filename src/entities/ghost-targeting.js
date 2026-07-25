// 4종 고스트의 CHASE 타깃 타일 계산 (PLAN.md §7). 전부 순수 함수 — 상태를 읽기만 하고
// 바꾸지 않는다. SCATTER/하우스 관련 타깃(자기 코너, 문 안팎)은 ghost.js에서 직접 처리.
import { Direction, DELTA, GhostName } from "../constants.js";
import { tileDistance } from "../maze.js";

// Pac-Man 진행 방향으로 n칸 앞 타일.
// [확인필요] 오리지널의 유명한 오버플로우 버그를 재현: Pac-Man이 UP을 보고 있을 때는
// 위로 n칸이 아니라 "위로 n칸 + 왼쪽으로 n칸"이 타깃이 된다 (Pinky/Inky 계산에 공통 적용).
function pacmanAheadTile(pacman, n) {
  const facing = pacman.direction === Direction.NONE ? Direction.LEFT : pacman.direction;
  const d = DELTA[facing];
  let col = pacman.col + d.col * n;
  const row = pacman.row + d.row * n;
  if (facing === Direction.UP) {
    col -= n;
  }
  return { col, row };
}

function blinkyTarget({ pacman }) {
  return { col: pacman.col, row: pacman.row };
}

function pinkyTarget({ pacman }) {
  return pacmanAheadTile(pacman, 4);
}

function inkyTarget({ pacman, ghosts }) {
  const pivot = pacmanAheadTile(pacman, 2);
  const blinky = ghosts[GhostName.BLINKY];
  return {
    col: pivot.col + (pivot.col - blinky.col),
    row: pivot.row + (pivot.row - blinky.row),
  };
}

// [확인필요] 8타일 임계값과 거리 계산 방식(유클리드로 근사) — 오리지널 정확 수치 불확실.
const CLYDE_THRESHOLD_TILES = 8;

function clydeTarget({ pacman, self }) {
  const distance = tileDistance({ col: self.col, row: self.row }, { col: pacman.col, row: pacman.row });
  if (distance > CLYDE_THRESHOLD_TILES) {
    return { col: pacman.col, row: pacman.row };
  }
  return self.scatterCorner;
}

export const TARGET_TILE_FN = {
  [GhostName.BLINKY]: blinkyTarget,
  [GhostName.PINKY]: pinkyTarget,
  [GhostName.INKY]: inkyTarget,
  [GhostName.CLYDE]: clydeTarget,
};
