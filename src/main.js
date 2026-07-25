import { CANVAS_WIDTH, CANVAS_HEIGHT, TICK_MS, MAX_FRAME_DELTA_MS } from "./constants.js";
import { createInput } from "./input.js";
import { Game } from "./game.js";
import { render } from "./renderer.js";

const canvas = document.getElementById("game");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext("2d");

const input = createInput();
const game = new Game(input);

// Fixed timestep + accumulator (PLAN.md §2).
// game.update()는 항상 TICK_MS(1/60초) 단위로만 호출한다 — grid 정렬, 타일 중심 방향 전환,
// scatter/chase 타이밍 같은 규칙이 화면 주사율이나 프레임 드랍과 무관하게 결정적으로 동작하도록 하기 위함.
// requestAnimationFrame은 "스케줄링 + 렌더링"에만 쓰고, 로직 전진 횟수는 누적기(accumulator)로 따로 관리한다.
let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  requestAnimationFrame(frame);

  // 탭 전환 등으로 delta가 크게 튀어도 한 프레임에 update가 무한히 몰리지 않도록 클램프
  // (spiral of death 방지).
  const delta = Math.min(now - lastTime, MAX_FRAME_DELTA_MS);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= TICK_MS) {
    game.update(TICK_MS / 1000);
    accumulator -= TICK_MS;
  }

  render(ctx, game);
}

requestAnimationFrame(frame);
