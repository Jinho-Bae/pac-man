import { Direction } from "./constants.js";

const KEY_TO_DIRECTION = {
  ArrowUp: Direction.UP,
  KeyW: Direction.UP,
  ArrowDown: Direction.DOWN,
  KeyS: Direction.DOWN,
  ArrowLeft: Direction.LEFT,
  KeyA: Direction.LEFT,
  ArrowRight: Direction.RIGHT,
  KeyD: Direction.RIGHT,
};

// direction: Pac-Man이 다음 교차로에서 시도할 "희망 방향" 버퍼 (계속 유지됨).
// pausePressed / startPressed: 1회성 입력 — game.js가 읽자마자 consume*로 리셋.
export function createInput() {
  const state = { direction: Direction.NONE, pausePressed: false, startPressed: false };

  window.addEventListener("keydown", (e) => {
    const dir = KEY_TO_DIRECTION[e.code];
    if (dir) {
      state.direction = dir;
      e.preventDefault();
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      state.pausePressed = true;
      e.preventDefault();
      return;
    }
    if (e.code === "Enter" || e.code === "Space") {
      state.startPressed = true;
      e.preventDefault();
    }
  });

  return state;
}

export function consumePausePressed(state) {
  const value = state.pausePressed;
  state.pausePressed = false;
  return value;
}

export function consumeStartPressed(state) {
  const value = state.startPressed;
  state.startPressed = false;
  return value;
}
