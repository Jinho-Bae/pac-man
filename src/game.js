import {
  GamePhase,
  GhostState,
  GhostName,
  STARTING_LIVES,
  SCORES,
  EXTRA_LIFE_THRESHOLD,
  SCATTER_CHASE_SCHEDULE,
  frightenedDurationForLevel,
  COLLISION_RADIUS,
  RESPAWN_PAUSE_SEC,
  LEVEL_CLEAR_PAUSE_SEC,
} from "./constants.js";
import { createMazeState } from "./maze.js";
import { PACMAN_START } from "./maze-data.js";
import { PacMan } from "./entities/pacman.js";
import { Ghost } from "./entities/ghost.js";
import { consumePausePressed, consumeStartPressed } from "./input.js";

// 최상위 오케스트레이터 (PLAN §5, §6, §9). GamePhase는 고스트 개별 state와는 별개의
// 최상위 상태이다. plain object에 가깝게 두되, 메서드가 많아 class로 구성.
export class Game {
  constructor(input) {
    this.input = input;

    this.pacman = new PacMan(PACMAN_START);
    this.ghosts = {
      [GhostName.BLINKY]: new Ghost(GhostName.BLINKY),
      [GhostName.PINKY]: new Ghost(GhostName.PINKY),
      [GhostName.INKY]: new Ghost(GhostName.INKY),
      [GhostName.CLYDE]: new Ghost(GhostName.CLYDE),
    };
    this.ghostList = Object.values(this.ghosts);

    this.maze = createMazeState();
    this.score = 0;
    this.highScore = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.awardedExtraLife = false;

    this.modeIndex = 0;
    this.modeTimer = 0;
    this.currentGlobalMode = GhostState.SCATTER;
    this.frightenedTimer = 0;
    this.ghostComboCount = 0;
    this.pauseTimer = 0;

    this.phase = GamePhase.MENU;
  }

  startNewGame() {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = 1;
    this.awardedExtraLife = false;
    this.startLevel();
  }

  startLevel() {
    this.maze = createMazeState();
    this.pacman.reset();
    for (const ghost of this.ghostList) ghost.reset();
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.currentGlobalMode = GhostState.SCATTER;
    this.frightenedTimer = 0;
    this.ghostComboCount = 0;
    this.phase = GamePhase.PLAYING;
  }

  update(dt) {
    if (
      consumePausePressed(this.input) &&
      (this.phase === GamePhase.PLAYING || this.phase === GamePhase.PAUSED)
    ) {
      this.phase = this.phase === GamePhase.PAUSED ? GamePhase.PLAYING : GamePhase.PAUSED;
    }

    switch (this.phase) {
      case GamePhase.MENU:
      case GamePhase.GAME_OVER:
        if (consumeStartPressed(this.input)) this.startNewGame();
        break;
      case GamePhase.PLAYING:
        this.updatePlaying(dt);
        break;
      case GamePhase.PAUSED:
        break;
      case GamePhase.RESPAWNING:
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) this.phase = GamePhase.PLAYING;
        break;
      case GamePhase.LEVEL_CLEAR:
        this.pauseTimer -= dt;
        if (this.pauseTimer <= 0) {
          this.level += 1;
          this.startLevel();
        }
        break;
      default:
        break;
    }
  }

  updatePlaying(dt) {
    this.pacman.setInputDirection(this.input.direction);
    this.pacman.update(dt, this.maze);

    this.updateGlobalMode(dt);

    const ctx = {
      maze: this.maze,
      level: this.level,
      pacman: this.pacman,
      ghosts: this.ghosts,
      currentGlobalMode: this.currentGlobalMode,
      frightenedActive: this.frightenedTimer > 0,
    };
    for (const ghost of this.ghostList) ghost.update(dt, ctx);

    this.handleEating();
    if (this.phase === GamePhase.PLAYING) this.handleGhostCollisions();
  }

  updateGlobalMode(dt) {
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        this.frightenedTimer = 0;
        for (const ghost of this.ghostList) ghost.exitFrightened(this.currentGlobalMode);
      }
      return; // frightened 동안은 scatter/chase 스케줄을 일시정지 (PLAN §6)
    }

    this.modeTimer += dt;
    const phaseDuration = SCATTER_CHASE_SCHEDULE[this.modeIndex];
    if (this.modeTimer >= phaseDuration) {
      this.modeTimer = 0;
      this.modeIndex = Math.min(this.modeIndex + 1, SCATTER_CHASE_SCHEDULE.length - 1);
      this.currentGlobalMode =
        this.currentGlobalMode === GhostState.SCATTER ? GhostState.CHASE : GhostState.SCATTER;
      for (const ghost of this.ghostList) {
        if (ghost.state === GhostState.SCATTER || ghost.state === GhostState.CHASE) {
          ghost.state = this.currentGlobalMode;
          ghost.reverseDirection(this.maze);
        }
      }
    }
  }

  handleEating() {
    const result = this.pacman.eatAt(this.maze);
    if (result === "dot") {
      this.score += SCORES.DOT;
    } else if (result === "pellet") {
      this.score += SCORES.POWER_PELLET;
      this.ghostComboCount = 0;
      this.frightenedTimer = frightenedDurationForLevel(this.level);
      for (const ghost of this.ghostList) ghost.enterFrightened(this.maze);
    }
    if (result) this.checkExtraLife();

    if (this.maze.dotsRemaining <= 0) {
      this.phase = GamePhase.LEVEL_CLEAR;
      this.pauseTimer = LEVEL_CLEAR_PAUSE_SEC;
    }
  }

  checkExtraLife() {
    if (!this.awardedExtraLife && this.score >= EXTRA_LIFE_THRESHOLD) {
      this.awardedExtraLife = true;
      this.lives += 1;
    }
  }

  handleGhostCollisions() {
    const pacPx = this.pacman.pixelPosition;
    for (const ghost of this.ghostList) {
      if (
        ghost.state !== GhostState.SCATTER &&
        ghost.state !== GhostState.CHASE &&
        ghost.state !== GhostState.FRIGHTENED
      ) {
        continue;
      }
      const ghostPx = ghost.pixelPosition;
      const dist = Math.hypot(pacPx.x - ghostPx.x, pacPx.y - ghostPx.y);
      if (dist >= COLLISION_RADIUS) continue;

      if (ghost.state === GhostState.FRIGHTENED) {
        ghost.getEaten();
        const combo = SCORES.GHOST_COMBO[Math.min(this.ghostComboCount, SCORES.GHOST_COMBO.length - 1)];
        this.score += combo;
        this.ghostComboCount += 1;
        this.checkExtraLife();
      } else {
        this.loseLife();
        return;
      }
    }
  }

  loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.highScore = Math.max(this.highScore, this.score);
      this.phase = GamePhase.GAME_OVER;
      return;
    }
    this.pacman.reset();
    for (const ghost of this.ghostList) ghost.reset();
    this.modeIndex = 0;
    this.modeTimer = 0;
    this.currentGlobalMode = GhostState.SCATTER;
    this.frightenedTimer = 0;
    this.phase = GamePhase.RESPAWNING;
    this.pauseTimer = RESPAWN_PAUSE_SEC;
  }
}
