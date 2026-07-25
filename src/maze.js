import { MAZE_ROWS } from "./maze-data.js";
import { GRID_COLS, GRID_ROWS, TILE_SIZE, DELTA, Direction } from "./constants.js";

const WALL = "#";
const POWER_PELLET = "o";

// 레벨/재시작마다 dot이 소비되므로 매번 새 상태를 만든다 (원본 MAZE_ROWS는 불변 템플릿).
export function createMazeState() {
  const walls = [];
  const dots = [];
  const pellets = [];
  const tunnelRows = new Set();
  let dotsRemaining = 0;

  for (let row = 0; row < GRID_ROWS; row++) {
    const line = MAZE_ROWS[row];
    const wallRow = new Array(GRID_COLS);
    const dotRow = new Array(GRID_COLS);
    const pelletRow = new Array(GRID_COLS);

    // 터널 행: 양 끝(col 0 / col GRID_COLS-1)이 벽 문자가 아니면 warp 가능한 행으로 표시.
    if (line[0] !== WALL || line[GRID_COLS - 1] !== WALL) {
      tunnelRows.add(row);
    }

    for (let col = 0; col < GRID_COLS; col++) {
      const ch = line[col];
      wallRow[col] = ch === WALL;
      pelletRow[col] = ch === POWER_PELLET;
      dotRow[col] = ch === "." || ch === POWER_PELLET;
      if (dotRow[col]) dotsRemaining++;
    }

    walls.push(wallRow);
    dots.push(dotRow);
    pellets.push(pelletRow);
  }

  return { walls, dots, pellets, tunnelRows, dotsRemaining, totalDots: dotsRemaining };
}

function wrapCol(col) {
  if (col < 0) return GRID_COLS - 1;
  if (col >= GRID_COLS) return 0;
  return col;
}

// 주어진 타일에서 direction으로 한 칸 이동했을 때의 타일을 반환.
// 벽이거나 격자 밖(터널 행이 아닌 경우)이면 null.
// 터널 행에서 좌우 경계를 넘으면 반대편 좌표로 wrap해서 반환.
export function neighborTile(maze, col, row, direction) {
  const d = DELTA[direction];
  let nextCol = col + d.col;
  const nextRow = row + d.row;

  if (nextCol < 0 || nextCol >= GRID_COLS) {
    if (!maze.tunnelRows.has(row)) return null;
    nextCol = wrapCol(nextCol);
  }
  if (nextRow < 0 || nextRow >= GRID_ROWS) return null;
  if (maze.walls[nextRow][nextCol]) return null;

  return { col: nextCol, row: nextRow };
}

const ALL_DIRECTIONS = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

// excludeDirection: 보통 "현재 방향의 역방향"을 넘겨서 후보에서 제외한다(§6 강제 반전 시엔 호출측에서 null로 넘김).
export function availableDirections(maze, col, row, excludeDirection = null) {
  const result = [];
  for (const dir of ALL_DIRECTIONS) {
    if (dir === excludeDirection) continue;
    if (neighborTile(maze, col, row, dir)) result.push(dir);
  }
  return result;
}

export function hasDot(maze, col, row) {
  return maze.dots[row]?.[col] === true;
}

export function isPowerPellet(maze, col, row) {
  return maze.pellets[row]?.[col] === true;
}

// 소비 성공 시 "dot" | "pellet", 이미 없으면 null.
export function consumeDot(maze, col, row) {
  if (!maze.dots[row]?.[col]) return null;
  const wasPellet = maze.pellets[row][col];
  maze.dots[row][col] = false;
  maze.dotsRemaining -= 1;
  return wasPellet ? "pellet" : "dot";
}

export function tileCenterPx(col, row) {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

export function tileDistance(a, b) {
  return Math.hypot(a.col - b.col, a.row - b.row);
}
