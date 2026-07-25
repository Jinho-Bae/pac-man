# PLAN.md — PAC-MAN Clone 구현 계획

## Context

Phase 0 인터뷰를 통해 SPEC.md(핵심 결정: 자체 디자인 미로, 정통 4종 Ghost AI, 사운드 끔, Vercel 배포)가 사용자 승인을 받았다. 이 문서는 "무엇을 만들지"가 아니라 "어떻게 만들지"를 정의한다 — 특히 game loop 구조, ghost state machine, grid 기반 충돌 판정처럼 코드 작성 전에 반드시 결정해야 하는 지점들을 다룬다. 목표는 코드를 쓰기 시작하는 순간 설계 관련 판단을 다시 하지 않아도 될 만큼 구체적인 청사진을 남기는 것.

---

## 1. 파일 구조

```
pac-man/
├── index.html            # <canvas> + <script type="module" src="src/main.js">
├── SPEC.md / PLAN.md / CLAUDE.md
└── src/
    ├── constants.js       # 모든 튜닝 수치(속도/타이밍/점수/색상/그리드) 한 곳에 집중. [확인필요] 표기 위치
    ├── maze.js             # 미로 char-map 데이터 + 파싱 + 질의 헬퍼(isWall, tileAt, tunnel warp)
    ├── input.js             # 키보드 → 방향 intent (arrow keys + WASD, pause)
    ├── entities/
    │   ├── pacman.js         # Pac-Man: 이동, 방향 버퍼링, 애니메이션, 섭취
    │   ├── ghost.js           # Ghost 공통: state machine, 이동 결정, 렌더 데이터
    │   └── ghost-targeting.js # Blinky/Pinky/Inky/Clyde 4종 target-tile 순수 함수
    ├── game.js               # 최상위 오케스트레이터: GamePhase, score/lives/level, 충돌, 승패
    ├── renderer.js            # 모든 canvas 드로잉 (읽기 전용, game 상태를 받아 그리기만 함)
    └── main.js                 # fixed-timestep game loop, 부트스트랩, 핵심 loop 주석 위치
```

ES modules는 번들러 없이 `<script type="module">` + native `import`로 바로 로드(정적 배포와 100% 호환, 빌드 스텝 불필요). 8개 소스 파일 정도로, 관심사 분리는 하되 과도하게 쪼개지 않는다.

Style 참고: Pac-Man/Ghost처럼 "정체성 있는" 엔티티는 `class`, Game/maze처럼 상태 묶음에 가까운 것은 plain object + 함수로 — CLAUDE.md에도 명시.

---

## 2. Game Loop 아키텍처 — Fixed timestep (accumulator) + rAF 렌더링

**결정: rAF로 스케줄링하되, 로직 업데이트는 고정 60Hz 틱으로 분리(accumulator 패턴). 렌더링은 매 rAF마다 최신 상태를 그린다.**

트레이드오프 분석:
- **순수 rAF(가변 dt)**: 구현은 가장 단순하지만, dt가 큰 스파이크(탭 전환, 저사양 기기)가 나면 grid 정렬 로직(타일 중심에서만 방향 전환 허용)이 깨질 수 있고, scatter/chase 타이밍처럼 "초 단위" 규칙을 프레임마다 다른 dt로 누적하면 재현성이 떨어진다.
- **고정 타임스텝 + accumulator**: rAF에서 받은 delta를 누적기에 더하고, `TICK_MS(=1000/60)`만큼 쌓일 때마다 `game.update(fixedDt)`를 (필요하면 여러 번) 호출. dt 스파이크는 누적기를 클램프(예: 최대 250ms)해서 spiral-of-death를 방지. 오리지널 아케이드도 사실상 고정 프레임 기반으로 동작했으므로, "몇 틱 동안 몇 픽셀 이동" 같은 규칙을 사람이 검증하기도 더 쉽다. 렌더 보간(interpolation)은 이 게임 속도/틱레이트에서는 체감 차이가 미미하므로 생략(최신 시뮬레이션 상태를 그대로 그림) — 구현 복잡도를 낮추는 의도적 단순화.

`main.js` 핵심 loop 골격(실제 구현 시 이 구조에 주석을 단다):

```js
const TICK_MS = 1000 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let delta = Math.min(now - lastTime, 250); // spiral-of-death 방지 클램프
  lastTime = now;
  accumulator += delta;
  while (accumulator >= TICK_MS) {
    game.update(TICK_MS / 1000); // 고정 dt(초 단위)
    accumulator -= TICK_MS;
  }
  renderer.render(game);
}
requestAnimationFrame(frame);
```

---

## 3. 좌표계 & 이동 모델

- 엔티티 위치 = `{ col, row }` 타일 좌표 + 현재 타일→다음 타일로의 진행률(0~1, 또는 px 단위 offset). 렌더링용 픽셀 좌표는 이 값에서 매 프레임 계산.
- 매 틱: `progress += speed * dt` 로 전진. `progress >= 1`이 되면 타일 경계를 넘은 것으로 보고 새 타일로 스냅, 그 타일이 "교차로(타일 중심)"이므로 이 시점에만:
  1. 버퍼링된 입력 방향(Pac-Man) 또는 target-tile 기반 결정(Ghost)을 적용해 다음 이동 방향을 재평가.
  2. 벽이면 그 방향 선택 불가 — 유효한 방향이 없으면 정지.
- 벽 충돌은 "애초에 벽 방향을 선택하지 않는다"로 처리 — 타일 사이를 이동하는 도중에는 별도 벽 충돌 검사가 필요 없음(진입 전에 이미 검증됨).
- Pac-Man 방향 버퍼링: 다음 교차로에서 적용할 "희망 방향"을 계속 저장해두고, 매 타일 중심 도달 시 우선 시도 → 막혀 있으면 기존 진행 방향 유지. 클래식 조작감의 핵심이라 반드시 구현.

---

## 4. 미로 자료구조

- **Char-map 방식**: 문자열 배열 한 줄 = 미로 한 행. `#` 벽, `.` dot, `o` power pellet, ` ` 빈 통로, `-` 고스트 하우스 문, `H` 하우스 내부 빈 타일. Pac-Man/Ghost 시작 좌표와 4개 scatter 코너, 하우스 bounding box는 별도 상수로 관리(char-map에 과부하 주지 않음).
- 파싱 시 2D 타일 타입 그리드로 변환 + dot 총개수 카운트(승리 조건 판정용).
- 자체 디자인 크기: **21열 × 23행**(대칭을 위해 홀수), `TILE_SIZE = 24px` → 플레이필드 504×552px + HUD 높이(~60px). 좌우 대칭, 좌우 끝 1쌍의 터널(같은 행, 양 끝이 열려 있음 → 반대편으로 warp), 중앙에 고스트 하우스 + 문.
- 미로 데이터는 로직과 분리된 `maze-data.js`로 사실상 상수 취급 — 시각적으로 한눈에 검증 가능한 게 최우선(개발 중 실제로 그려서 대칭/이동 가능 경로를 눈으로 확인).

---

## 5. 엔티티 자료구조

```js
// Pac-Man
{ col, row, progress, direction, bufferedDirection, mouthAnim, alive }

// Ghost (4개 인스턴스, personality로 파라미터화)
{
  name,                 // "blinky" | "pinky" | "inky" | "clyde"
  color, scatterCorner,  // 자기 홈 코너 타일
  col, row, progress, direction,
  state,                  // GhostState: IN_HOUSE | LEAVING_HOUSE | SCATTER | CHASE | FRIGHTENED | EATEN
  targetTileFn            // ghost-targeting.js의 해당 personality 함수 참조
}
```

Game(orchestrator, plain object + 함수):
```js
{ phase, score, highScore, lives, level, dotsRemaining, modeTimer, frightenedTimer, maze, pacman, ghosts[] }
```
`phase`: `MENU | PLAYING | PAUSED | LEVEL_CLEAR | GAME_OVER` (ghost 개별 상태와 별개의 최상위 상태).

---

## 6. Ghost State Machine (scatter/chase/frightened/eaten)

```
IN_HOUSE → (타이머/조건 충족) → LEAVING_HOUSE → SCATTER ⇄ CHASE (전역 modeTimer로 동시 교대)
SCATTER/CHASE --[Power Pellet]--> FRIGHTENED --[시간 만료]--> (교대 시점의 SCATTER 또는 CHASE로 복귀)
FRIGHTENED --[Pac-Man과 충돌]--> EATEN --[하우스 문 도달]--> LEAVING_HOUSE → SCATTER/CHASE
(SCATTER/CHASE 상태에서 Pac-Man과 충돌) → Pac-Man 생명 감소, 전원 초기 위치로 리셋
```

- **전역 modeTimer**: 모든 SCATTER/CHASE 중인 고스트가 공유하는 하나의 타이머가 페이즈를 결정(고스트 개별 타이머 아님) — 오리지널 동작 방식. FRIGHTENED 동안은 이 타이머를 **일시정지**하고, 종료 후 그 시점의 남은 페이즈부터 재개.
- **강제 방향 반전**: 전역 모드가 전환되는 순간(SCATTER↔CHASE, 또는 FRIGHTENED 진입) 살아있는 모든 고스트는 다음 틱에 즉시 진행 방향을 반전 — 이 자체는 오리지널의 잘 알려진 규칙이라 [확인필요] 없이 그대로 구현.
- **타일 중심에서의 방향 선택 규칙**: 벽이 아니고 "현재 방향의 역방향이 아닌" 후보 중, 이동 후 타일이 목표 타일까지의 거리를 최소화하는 방향을 선택. 동률이면 우선순위 Up > Left > Down > Right (오리지널 문서화된 규칙, 구현하되 [확인필요] 태그). FRIGHTENED 중에는 목표 타일 대신 유효 방향 중 무작위 선택(역방향 금지 규칙은 동일 적용).
- **EATEN(눈)**: 목표 타일 = 하우스 문. 속도 상승, Pac-Man과 충돌 무시, 문 도달 시 LEAVING_HOUSE로 전환 후 현재 전역 페이즈로 복귀.
- **하우스 방출**: v1은 타이머 기반 순차 방출로 단순화(예: 5초 간격으로 한 마리씩). 오리지널의 dot-counter 기반 방출 조건은 [확인필요]/향후 개선 포인트로 §15에 남김.

---

## 7. Ghost Targeting 알고리즘 (4종, `ghost-targeting.js`에 순수 함수로 구현)

공유 헬퍼: `pacmanAheadTile(n)` — Pac-Man 진행 방향으로 n칸 앞 타일. **단, 방향이 UP일 때는 원작의 오버플로우 버그를 재현**: 위쪽 n칸이 아니라 "위쪽 n칸 + 왼쪽 n칸"이 목표가 됨. Pinky(n=4)와 Inky의 중간 계산(n=2)에 공통 적용.

| Ghost | targetTile(gameState) |
|---|---|
| Blinky | `pacman.tile` (직접 추적) |
| Pinky | `pacmanAheadTile(4)` |
| Inky | `pivot = pacmanAheadTile(2)`; `vector = pivot - blinky.tile`; `target = pivot + vector` (Blinky 기준 점대칭 벡터 2배 연장 — 4마리 중 유일하게 다른 고스트 상태에 의존) |
| Clyde | `distance(clyde.tile, pacman.tile) > 8` ? `pacman.tile` : `clyde.scatterCorner` |

SCATTER 상태에서는 4종 모두 공통적으로 `targetTile = 자신의 scatterCorner`.

이 알고리즘들은 [확인필요] 수치(정확한 오버플로우 버그의 -4/-4 계수, Clyde의 8타일 임계값, 거리 계산 방식)를 제외하면 구조 자체는 잘 문서화되어 있어 확신도가 높다 — 다만 수치는 constants.js에 상수로 빼서 쉽게 조정 가능하게 한다.

---

## 8. Collision & 판정 규칙

- **Pac-Man ↔ dot/pellet**: Pac-Man의 현재 타일에 dot/pellet이 있으면 즉시 소비(단순 타일 일치 검사로 충분 — 둘 다 그리드에 스냅되어 있음).
- **Pac-Man ↔ Ghost**: 매 틱, 두 엔티티의 픽셀 중심 좌표 간 유클리드 거리 < `COLLISION_RADIUS`(예: 타일 크기의 절반)면 충돌로 판정. 순수 타일 일치 검사보다 스쳐 지나가는 경우도 안정적으로 잡아냄.
  - Ghost가 SCATTER/CHASE 상태 → Pac-Man 생명 -1, 전원 시작 위치로 리셋, 잠시 대기 후 재개.
  - Ghost가 FRIGHTENED 상태 → 해당 Ghost EATEN 전환 + 콤보 점수, Pac-Man은 계속 진행.
  - Ghost가 EATEN 상태 → 무시(이미 "눈"만 있는 상태).
- **벽 충돌**: §3에서 설명한 대로 애초에 벽 방향을 선택하지 않으므로 별도 로직 불필요.
- **터널 warp**: 타일 좌표가 미로 경계를 벗어나면 반대편 좌표로 순간 이동(진행 방향/속도 유지).

---

## 9. 점수 / 목숨 / 레벨 진행

- Dot 10점, Power Pellet 50점, Ghost 콤보 200→400→800→1600(파워펠릿마다 리셋), Fruit는 stretch(§15). **모두 [확인필요] — constants.js의 `SCORES` 객체 한 곳에 모아 튜닝.**
- 1UP 임계값 10,000점 [확인필요], 상수로 분리.
- 목숨 3 → 0에서 GAME_OVER phase.
- `dotsRemaining === 0` → LEVEL_CLEAR phase → 짧은 연출 후 레벨 +1, 미로 리셋(dot/pellet 재배치), 고스트 speed/frightened 시간 등 난이도 소폭 상승(§6·§7의 상수들이 레벨 함수로 계산되도록 constants.js에서 `speedForLevel(level)`, `frightenedDurationForLevel(level)` 형태로 설계).

---

## 10. Rendering 전략 (`renderer.js`)

- 순수 함수적으로 game 상태를 읽어서만 그림(상태 변경 없음).
- 매 프레임: canvas clear → 미로(벽/터널/문) → dot/pellet(파워펠릿은 pulsing) → Ghost(정상 색상 / FRIGHTENED는 파랑+종료 임박 시 흰색 점멸 / EATEN은 눈만) → Pac-Man(방향에 따라 회전하는 입 벌림 애니메이션) → HUD(점수/하이스코어/목숨/레벨) → phase별 오버레이(MENU/PAUSED/GAME_OVER/LEVEL_CLEAR 텍스트).
- 전부 `arc/fillRect/path` 등 Canvas 2D 기본 도형으로만 구성 — 이미지 에셋 없음(Hard 제약).

---

## 11. Constants & [확인필요] 관리

`constants.js` 하나에 다음을 전부 모은다: `TILE_SIZE`, `GRID_COLS/ROWS`, `TICK_MS`, 속도 관련(`PACMAN_SPEED`, `GHOST_SPEED_RATIO`, `FRIGHTENED_SPEED_RATIO`, `EATEN_SPEED_RATIO`), 타이밍(`SCATTER_CHASE_SCHEDULE`, `frightenedDurationForLevel`), `SCORES`, `EXTRA_LIFE_THRESHOLD`, 색상 팔레트. 각 [확인필요] 항목은 정의부 바로 위에 한 줄 주석으로 근거/불확실성을 남긴다(예: `// [확인필요] 오리지널 정확 수치 불확실 — Pac-Man Dossier 기반 근사치`).

---

## 12. 배포 계획 (Vercel)

- 프로젝트는 순수 정적 사이트 → Vercel이 자동으로 "Other/Static"으로 인식, **build command 불필요, `vercel.json` 없이도 배포 가능**(필요해지면 그때 최소 설정만 추가).
- 로컬에 git repo가 없어도 `vercel` CLI는 로컬 디렉터리를 직접 업로드해 배포 가능 — git 초기화는 이번 범위 밖(요청 시에만).
- 절차:
  1. `vercel --version` 확인(현재 세션엔 54.7.1 감지됨, 57.0.0 권장 업그레이드 — 배포 자체엔 지장 없어 선택 사항으로 안내).
  2. `vercel login` — **사람이 직접 해야 하는 1회성 인터랙티브 인증**(자동화 불가/안 함).
  3. 프로젝트 루트에서 `vercel` → 최초 1회 프로젝트 링크(디렉터리/프로젝트명 확인) → preview URL 발급.
  4. `vercel --prod` → production URL 발급.
  5. **Hard 제약에 따라 3~4단계(실제 배포)는 실행 직전 반드시 사용자에게 재확인받는다** — 구현 완료 == 자동 배포 아님.
- 대안으로 이 세션에 연동된 `vercel:deploy` 스킬(`/vercel:deploy prod`)을 사용해도 동일한 결과를 더 매끄럽게 얻을 수 있음 — CLAUDE.md에 두 방법 모두 기록.

---

## 13. 검증 체크리스트 (End-to-End)

**로컬(코드 작성 직후, 배포 전):**
1. `python3 -m http.server 8000`로 무의존성 로컬 프리뷰(빌드 불필요) → `run`/`verify` 스킬로 실제 브라우저에서 구동해 콘솔 에러 없는지 확인.
2. 수동 플레이 체크리스트: 방향키+WASD 4방향 이동 및 코너 버퍼링 / dot·pellet 섭취와 점수 반영 / Power Pellet → 4마리 전원 FRIGHTENED 전환(파랑, 도주 이동) / FRIGHTENED 고스트 포식 → 콤보 점수 증가 + 눈 상태로 하우스 복귀 / 비FRIGHTENED 고스트에 접촉 → 생명 감소 + 리스폰 / 생명 0 → GAME_OVER + 재시작 동작 / 모든 dot 섭취 → LEVEL_CLEAR → 다음 레벨 진행 / 터널 좌우 warp / Scatter↔Chase가 주기적으로 육안 확인되는지(고스트가 주기적으로 자기 코너로 이동) / HUD 수치 동기화.
3. 성능: 몇 분 플레이해도 프레임 저하·메모리 누수 체감 없는지 간단 확인.

**배포 후:**
4. `vercel --prod` 실행(사용자 확인 후) → 발급된 production URL 확보.
5. 해당 URL을 fetch해 HTTP 200 + 기대한 HTML(제목/canvas 요소) 응답 확인 — 정적 자산이 올바르게 서빙되는지에 대한 구조적 검증.
6. **한계 고지**: canvas 기반 인터랙티브 플레이 자체는 fetch/curl로 검증 불가능하므로, 배포 URL에서의 실제 플레이 확인은 로컬에서 이미 브라우저로 검증했다는 전제 하에 **사용자가 직접 접속해 최종 확인**하는 것을 검증 체크리스트의 마지막 항목으로 명시한다(허위로 "배포 URL에서 플레이 확인 완료"라고 보고하지 않음).

---

## 14. 향후 확장 포인트 (이번 범위 밖 — SPEC.md §9 재확인)

Fruit 보너스 아이템, dot-counter 기반 정통 하우스 방출, Cruise Elroy, Web Audio 사운드, 모바일 터치 컨트롤, localStorage 영구 하이스코어. 모두 지금 아키텍처(특히 constants.js 분리, targeting 순수 함수 구조)를 크게 바꾸지 않고 얹을 수 있도록 설계했다.
