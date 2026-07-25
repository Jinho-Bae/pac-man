// 모든 튜닝 가능한 수치를 한 곳에 모은다 (PLAN.md §11).
// [확인필요] 표기가 붙은 값은 오리지널 아케이드의 정확한 수치가 불확실해
// 합리적 근사치로 시작한 것 — 여기만 고치면 게임 전체에 반영된다.

export const TILE_SIZE = 24;
export const GRID_COLS = 21;
export const GRID_ROWS = 23;
export const HUD_HEIGHT = 60;

export const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE + HUD_HEIGHT;

export const TICK_MS = 1000 / 60;
// rAF delta가 크게 튀어도(탭 전환 등) 한 프레임에 과도한 update가 몰리지 않도록 클램프.
export const MAX_FRAME_DELTA_MS = 250;

export const Direction = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  NONE: "NONE",
});

export const DELTA = Object.freeze({
  [Direction.UP]: { col: 0, row: -1 },
  [Direction.DOWN]: { col: 0, row: 1 },
  [Direction.LEFT]: { col: -1, row: 0 },
  [Direction.RIGHT]: { col: 1, row: 0 },
  [Direction.NONE]: { col: 0, row: 0 },
});

export const OPPOSITE = Object.freeze({
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
  [Direction.NONE]: Direction.NONE,
});

// 타일 중심에서 이동 방향이 동률일 때의 우선순위.
// [확인필요] Pac-Man Dossier 등에서 통용되는 값이나 오리지널 원본 대조는 못함.
export const DIRECTION_PRIORITY = [Direction.UP, Direction.LEFT, Direction.DOWN, Direction.RIGHT];

// [확인필요] 오리지널의 정확한 타일/초 속도 불명 — 그럴듯한 근사치.
const BASE_TILES_PER_SECOND = 8;
export const PACMAN_SPEED = BASE_TILES_PER_SECOND * TILE_SIZE; // px/sec

export const GHOST_SPEED_RATIO = {
  SCATTER: 0.85,
  CHASE: 0.85,
  FRIGHTENED: 0.5,
  EATEN: 1.6,
  IN_HOUSE: 0.4,
};

// 레벨이 오를수록 고스트가 소폭 빨라짐. [확인필요] 정확한 증가폭.
export function ghostSpeedForLevel(level, ratio) {
  const levelBonus = Math.min((level - 1) * 0.02, 0.15);
  return PACMAN_SPEED * (ratio + levelBonus);
}

export const GhostName = Object.freeze({
  BLINKY: "blinky",
  PINKY: "pinky",
  INKY: "inky",
  CLYDE: "clyde",
});

export const GhostState = Object.freeze({
  IN_HOUSE: "IN_HOUSE",
  LEAVING_HOUSE: "LEAVING_HOUSE",
  SCATTER: "SCATTER",
  CHASE: "CHASE",
  FRIGHTENED: "FRIGHTENED",
  EATEN: "EATEN",
});

export const GamePhase = Object.freeze({
  MENU: "MENU",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  RESPAWNING: "RESPAWNING",
  LEVEL_CLEAR: "LEVEL_CLEAR",
  GAME_OVER: "GAME_OVER",
});

// Scatter/Chase 교대 스케줄(초). 마지막 구간은 Infinity로 이후 계속 CHASE.
// [확인필요] 오리지널은 레벨별로 스케줄이 다르나(PLAN §9), v1은 전 레벨 공통 근사치로 단순화.
export const SCATTER_CHASE_SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity];

// [확인필요] frightened 지속시간은 레벨이 오를수록 짧아짐 — 근사 공식.
export function frightenedDurationForLevel(level) {
  return Math.max(1, 6 - (level - 1) * 0.5);
}

// 종료 임박 시 흰색으로 점멸 시작하는 남은시간(초).
export const FRIGHTENED_WARNING_SEC = 2;

// 하우스 방출: v1은 dot-counter가 아닌 타이머 기반 순차 방출로 단순화(PLAN §6). [확인필요]
export const HOUSE_RELEASE_DELAY_SEC = {
  [GhostName.BLINKY]: 0,
  [GhostName.PINKY]: 1,
  [GhostName.INKY]: 5,
  [GhostName.CLYDE]: 9,
};

export const COLLISION_RADIUS = TILE_SIZE * 0.5;

// [확인필요] 오리지널 점수표 근사치 — Pac-Man Dossier 등에서 통용되는 값.
export const SCORES = {
  DOT: 10,
  POWER_PELLET: 50,
  GHOST_COMBO: [200, 400, 800, 1600],
};

// [확인필요] 1UP 임계 점수.
export const EXTRA_LIFE_THRESHOLD = 10000;

export const STARTING_LIVES = 3;

// 고스트에게 잡힌 후 리스폰까지 대기시간, 레벨 클리어 연출 시간 등.
export const RESPAWN_PAUSE_SEC = 1.5;
export const LEVEL_CLEAR_PAUSE_SEC = 2;

export const COLORS = {
  background: "#000000",
  wall: "#2121ff",
  door: "#ffb8ff",
  dot: "#ffd8ae",
  pacman: "#ffff00",
  frightened: "#1a1aee",
  frightenedWarning: "#ffffff",
  eyes: "#ffffff",
  text: "#ffffff",
  textDim: "#8888aa",
  ghosts: {
    [GhostName.BLINKY]: "#ff0000",
    [GhostName.PINKY]: "#ffb8ff",
    [GhostName.INKY]: "#00ffff",
    [GhostName.CLYDE]: "#ffb852",
  },
};
