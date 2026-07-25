# CLAUDE.md

## 프로젝트
Vanilla JS + HTML5 Canvas 클래식 PAC-MAN 클론. 외부 의존성 0, 완전 정적 사이트(빌드 스텝 없음).

## 로컬 미리보기
```
python3 -m http.server 8000   # 프로젝트 루트에서 실행 → http://localhost:8000
```
(대안: `npx serve` — 로컬 편의 도구일 뿐, 게임 자체의 의존성이 아님)

## 배포
```
vercel --prod
```
또는 이 세션에 연동된 `/vercel:deploy prod` 스킬. **반드시 실행 직전 사용자 확인** — 배포는 비가역/외부 영향 작업.

## Code Style
- 외부 라이브러리·프레임워크·CDN 금지. Vanilla JS(ES modules) + Canvas 2D API만 사용.
- 이미지/오디오 등 외부 에셋 파일 금지 — 전부 코드로 드로잉/생성.
- 모든 튜닝 수치(속도/타이밍/점수)는 `src/constants.js` 한 곳에 모아 관리. `[확인필요]` 항목은 정의부 위에 한 줄로 근거/불확실성 표기.
- `class`는 Pac-Man/Ghost 같은 "정체성 있는" 엔티티에만 사용, Game/maze 등은 plain object + 함수.
- 주석은 WHY만: 자명한 동작 설명 금지, 오리지널과 다르거나 불확실한 부분만 짧게.

## 검증
- 로컬: 콘솔 에러 없음 + PLAN.md §13의 수동 플레이 체크리스트 통과(run/verify 스킬로 실제 브라우저 구동).
- 배포 후: production URL fetch로 200/정상 로드 확인 + 사용자가 실제 브라우저에서 최종 플레이 확인.
