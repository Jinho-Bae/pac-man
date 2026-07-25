// 순수하게 game 상태를 읽어서 그리기만 한다 (상태 변경 없음, PLAN §10).
// 전부 Canvas 2D 기본 도형(arc/fillRect/path)으로 구성 — 이미지 에셋 없음.
import {
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  HUD_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  Direction,
  DELTA,
  GamePhase,
  GhostState,
} from "./constants.js";

const DIRECTION_ANGLE = {
  [Direction.RIGHT]: 0,
  [Direction.DOWN]: Math.PI / 2,
  [Direction.LEFT]: Math.PI,
  [Direction.UP]: -Math.PI / 2,
  [Direction.NONE]: 0,
};

export function render(ctx, game) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  drawMaze(ctx, game.maze);
  drawPacman(ctx, game.pacman);
  for (const ghost of game.ghostList) drawGhost(ctx, ghost);
  ctx.restore();

  drawHud(ctx, game);
  drawOverlay(ctx, game);
}

function drawMaze(ctx, maze) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      if (maze.walls[row][col]) {
        const pad = 2;
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x + pad, y + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2);
        continue;
      }

      if (!maze.dots[row]?.[col]) continue;
      const cx = x + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;
      ctx.fillStyle = COLORS.dot;
      ctx.beginPath();
      if (maze.pellets[row][col]) {
        const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 150);
        ctx.arc(cx, cy, TILE_SIZE * 0.3 * pulse, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, TILE_SIZE * 0.08, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
}

function drawPacman(ctx, pacman) {
  const { x, y } = pacman.pixelPosition;
  const radius = TILE_SIZE * 0.45;
  const mouthOpen = Math.abs(Math.sin(pacman.mouthPhase * 8)) * 0.22 + 0.02;
  const angle = DIRECTION_ANGLE[pacman.direction] ?? 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = COLORS.pacman;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, mouthOpen * Math.PI, (2 - mouthOpen) * Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function ghostBodyColor(ghost) {
  if (ghost.state === GhostState.FRIGHTENED) return COLORS.frightened;
  return ghost.color;
}

function drawGhost(ctx, ghost) {
  const { x, y } = ghost.pixelPosition;
  const r = TILE_SIZE * 0.45;

  if (ghost.state !== GhostState.EATEN) {
    ctx.fillStyle = ghostBodyColor(ghost);
    ctx.beginPath();
    // 반원 돔(왼쪽 -> 위 -> 오른쪽) + 물결치는 아랫단.
    ctx.arc(x, y, r, Math.PI, 2 * Math.PI);
    const hemLevel = y + r * 0.55;
    ctx.lineTo(x + r, hemLevel);
    ctx.lineTo(x + r * 0.5, y + r);
    ctx.lineTo(x, hemLevel);
    ctx.lineTo(x - r * 0.5, y + r);
    ctx.lineTo(x - r, hemLevel);
    ctx.closePath();
    ctx.fill();
  }

  const eyeOffsetX = r * 0.42;
  const eyeOffsetY = -r * 0.1;
  const eyeR = r * 0.24;
  const pupilR = r * 0.12;
  const d = DELTA[ghost.direction] ?? { col: 0, row: 0 };

  for (const side of [-1, 1]) {
    const ex = x + side * eyeOffsetX;
    const ey = y + eyeOffsetY;
    ctx.fillStyle = COLORS.eyes;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#10108c";
    ctx.beginPath();
    ctx.arc(ex + d.col * pupilR, ey + d.row * pupilR, pupilR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
  ctx.textBaseline = "middle";

  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.text;
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(`SCORE ${game.score}`, 12, HUD_HEIGHT / 2 - 10);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = "12px 'Courier New', monospace";
  ctx.fillText(`HIGH ${game.highScore}`, 12, HUD_HEIGHT / 2 + 12);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.text;
  ctx.font = "16px 'Courier New', monospace";
  ctx.fillText(`LEVEL ${game.level}`, CANVAS_WIDTH - 12, HUD_HEIGHT / 2 - 10);

  const iconR = 7;
  for (let i = 0; i < game.lives; i++) {
    const cx = CANVAS_WIDTH - 16 - i * (iconR * 2 + 8) - iconR;
    const cy = HUD_HEIGHT / 2 + 14;
    ctx.fillStyle = COLORS.pacman;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, iconR, 0.3 * Math.PI, 1.7 * Math.PI);
    ctx.closePath();
    ctx.fill();
  }
}

const OVERLAY_MESSAGES = {
  [GamePhase.MENU]: ["PAC-MAN", "Press Enter / Space to Start", "Arrows or WASD to move"],
  [GamePhase.PAUSED]: ["PAUSED"],
  [GamePhase.GAME_OVER]: ["GAME OVER", "Press Enter / Space to Restart"],
  [GamePhase.LEVEL_CLEAR]: ["LEVEL CLEAR!"],
};

function drawOverlay(ctx, game) {
  const lines = OVERLAY_MESSAGES[game.phase];
  if (!lines) return;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lineHeight = 28;
  const startY = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.font = i === 0 ? "bold 28px 'Courier New', monospace" : "16px 'Courier New', monospace";
    ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineHeight);
  });
  ctx.restore();
}
