# PROMPTS.md — 프롬프트 & 리뷰 로그

AI(Claude Opus 5, Claude Code CLI)와 협업한 기록이다.
기능 단위로 쪼개 지시했고, 커밋 1개 = 기능 1개 = 아래 섹션 1개로 대응된다.

각 섹션은 다음 형식이다.

- **프롬프트** — AI에 준 지시 원문 (요약 아님)
- **AI 출력 요지** — 무엇을 내놓았나
- **리뷰 / 검증** — 무엇이 문제였고, 어떻게 알아냈고, 어떤 판단을 왜 했나

> 검증 항목은 실제로 실행·재현해서 확인한 것만 적었다.
> 확인하지 못한 항목은 `미검증`으로 명시했다. 추측을 검증으로 쓰지 않았다.

---

## [setup] 프로젝트 세팅

### 프롬프트 1

```
채용 파이프라인 보드를 만든다. 코딩테스트 과제고 제약이 있다.

- Vite + React 19 + TypeScript + Tailwind CSS
- 테스트: Vitest + React Testing Library + jsdom
- 상태관리 라이브러리 없음. useReducer + Context로 직접 짠다.
- TanStack Query 쓰지 않는다. 낙관적 업데이트/롤백이 이 과제의 평가 대상이라
  라이브러리가 대신하면 안 된다.

지금은 세팅만 해라. 앱 코드는 다음 단계에서 쓴다.
1) package.json / vite.config.ts / tsconfig / tailwind 설정
2) vitest 설정 (jsdom, setup 파일에 @testing-library/jest-dom)
3) eslint + prettier (규칙 과하게 넣지 마라)
4) src 폴더 구조만 빈 디렉터리로:
   features/board, features/applicants, mocks, lib, components
5) npm run dev / test / build 스크립트

.gitignore 포함. App.tsx는 "보드 준비 중" 한 줄 플레이스홀더면 된다.
```

### AI 출력 요지

`package.json`(scripts만) → 의존성은 `npm install`로 최신 버전 해석하도록 하고,
`vite.config.ts`(vitest 설정 통합), `tsconfig.json`(strict + `noUncheckedIndexedAccess`),
`eslint.config.js`(flat config), `.prettierrc`, `index.html`,
`src/{main.tsx,App.tsx,index.css,vite-env.d.ts,test/setup.ts}` 생성.
Tailwind는 v4의 `@tailwindcss/vite` 플러그인 + CSS에 `@import 'tailwindcss'` 방식 선택.

### 리뷰 / 검증

**1) TypeScript 7이 설치되어 ESLint 툴체인이 깨졌다 — 버전을 내려 해결**

- **무엇이 문제였나**: 의존성 버전을 손으로 적지 않고 `npm install`에 맡겼는데,
  npm이 `typescript@7.0.2`를 설치했다. 이어서 lint 의존성을 설치하니 ERESOLVE로 실패.
- **어떻게 알아냈나**: `npm install -D typescript-eslint` 가 exit 1. 에러 원문:
  ```
  Found: typescript@7.0.2
  peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.69.0
  ```
- **판단**: `--legacy-peer-deps`로 넘기지 않고 **TypeScript를 `~5.9`로 내렸다.**
  TS 7은 신규 컴파일러라 lint 생태계가 아직 못 따라온다. 채용 과제에서
  "최신 버전을 썼다"는 것보다 툴체인이 안 깨지는 게 중요하다고 봤다.
  `--legacy-peer-deps`는 문제를 숨기는 쪽이라 기각.

**2) `node:url` 타입 누락으로 `tsc --noEmit` 실패 — AI 초안의 실제 누락**

- **무엇이 문제였나**: AI가 `vite.config.ts`에서 경로 alias를 위해
  `import { fileURLToPath } from 'node:url'`을 썼는데 `@types/node`를 빼먹었다.
- **어떻게 알아냈나**: `npm run build` 실행 →
  `vite.config.ts(4,31): error TS2307: Cannot find module 'node:url'`.
  vite build 자체는 통과하므로 `tsc --noEmit`을 build 스크립트에 넣어두지 않았다면
  못 잡았을 오류다.
- **어떻게 고쳤나**: `@types/node`를 devDependency로 추가.

**3) `eslint-plugin-react-hooks` v7의 flat config 경로가 바뀌어 있었다**

- **무엇이 문제였나**: AI가 `reactHooks.configs['recommended-latest']`를 썼다.
  이는 v5 기준의 관용구인데, v7에서는 이 키가 여전히 **eslintrc(legacy) 형식**이다.
  ESLint 10은 `plugins`가 배열이면 거부한다:
  `A config object has a "plugins" key defined as an array of strings.`
- **어떻게 알아냈나**: `npm run lint` 실패 → 플러그인의 export를 직접 열어 확인.
  ```
  node -e "import('eslint-plugin-react-hooks').then(m=>{...})"
  recommended        | plugins: ARRAY(legacy)
  recommended-latest | plugins: ARRAY(legacy)
  flat               | keys: recommended-latest, recommended
  ```
  즉 flat config용은 `configs.flat['recommended-latest']` 아래로 이동했다.
- **어떻게 고쳤나**: 해당 경로로 교체하고, 왜 그 경로인지 코드에 주석으로 남겼다.
  (다음에 버전을 올릴 때 다시 헤매지 않도록)

**4) 테스트 0개일 때 `npm run test`가 죽는 문제 — 선제 처리**

- `vitest run`은 테스트 파일이 없으면 exit 1이다. 커밋 0~6은 테스트가 없으므로
  세팅 단계에서 `npm run test`가 실패하게 된다.
- `passWithNoTests: true`를 설정하고, **실제로 exit code 0인지 확인**했다:
  `No test files found, exiting with code 0`.

**5) Tailwind v4가 실제로 동작하는지 확인 (설정만 보고 넘기지 않았다)**

- Tailwind v4는 v3와 설정 방식이 다르다(`tailwind.config.js` + `content` 배열이 아니라
  Vite 플러그인 + CSS `@import`). 설정이 그럴듯해 보여도 클래스가 안 먹을 수 있다.
- `npm run build` 후 **산출된 CSS를 직접 grep** 해서 확인:
  ```
  min-h-dvh          1
  place-items-center 1
  bg-slate-100       1
  text-slate-600     1
  ```
  4개 모두 존재 → JIT 스캔이 `src`를 제대로 훑고 있다. CSS 4.63kB.

**최종 상태**: `npm run build` / `test` / `lint` 3개 모두 통과.

**미검증**: `npm run dev`의 HMR 동작. (dev 서버는 이후 UI 커밋에서 실제로 띄워 확인할 예정)

---

## [mock-api] 목 API 자체 구현

### 프롬프트 1

```
mock API를 자체 구현한다. 실제 백엔드는 없다.

도메인
- Applicant: id, name, position(직무), appliedAt(지원일), stage, version,
  상세용 필드 email, phone, experienceYears, resumeSummary, memo
- Stage: 'screening'(서류검토) | 'interview'(면접) | 'offer'(처우협의)
  | 'hired'(최종합격) | 'rejected'(불합격)

mock 서버 (src/mocks/)
- 모든 응답에 200~800ms 랜덤 지연
- 약 15% 확률로 실패
- 저장소는 localStorage. 새로고침 후에도 이동 결과가 유지돼야 한다.
- 시드 고정 PRNG로 지원자를 결정론적으로 생성. 건수는 200 / 1000 전환 가능하게.
- 엔드포인트:
  listApplicants()
  getApplicant(id)
  moveApplicantStage({ id, toStage, expectedVersion })
- moveApplicantStage는 expectedVersion이 서버 version과 다르면
  409 개념의 ConflictError를 던지고 서버의 현재 상태를 함께 담아 반환한다.
  성공하면 version을 +1 한다.
- 지연과 실패확률을 테스트에서 강제 주입/고정할 수 있게 설계해라.
  전역 Math.random 몽키패치 말고 명시적 config 주입 방식으로.

한글 이름과 직무는 그럴듯하게 생성. 지원일은 최근 90일 범위.
```

### AI 출력 요지

`src/domain/applicant.ts`(타입·STAGES), `src/mocks/`에
`random.ts`(mulberry32 PRNG), `config.ts`(주입 가능한 설정),
`seed.ts`(결정론적 생성), `store.ts`(메모리 + localStorage), `errors.ts`
(MockApiError/NetworkError/NotFoundError/ConflictError), `api.ts`(3개 엔드포인트) 생성.
설정은 `configureMock(patch)` / `resetMockConfig()`로 주입하고,
실패 판정은 `failureRate`가 0이나 1이면 난수를 아예 건드리지 않게 해서
테스트가 난수 스텁 없이도 결정론적이 되도록 했다.

### 리뷰 / 검증

**1) 이름 음절 배열에 한글 아닌 문자가 섞여 있었다**

- **무엇이 문제였나**: `GIVEN_FIRST`에 `'نا'`(아랍 문자), `GIVEN_SECOND`에 `'訓'`(한자)이
  들어가 있었다. 그대로 두면 "김نا훈" 같은 이름이 생성된다.
- **어떻게 알아냈나**: 눈으로 훑다가 발견하고, 확인 사살로 파일 전체를 코드포인트로 스캔했다.
  `한글 음절(AC00~D7A3)이 아닌 U+2500 이상 문자`를 뽑는 스크립트를 돌려 0개가 될 때까지 고쳤다.
- **판단**: 수정. 이런 종류는 리뷰로만 잡으면 놓치기 쉬워서, 사람 눈이 아니라 스캔으로 확인했다.

**2) 테스트가 실제로 이빨이 있는지 — 구현을 일부러 깨서 확인했다 (변이 테스트)**

테스트 17개가 **첫 실행에 전부 통과**했다. 이건 좋은 신호가 아니라 의심할 지점이다.
테스트가 느슨해서 통과한 건지 구별해야 하므로, 구현을 의도적으로 망가뜨려
테스트가 잡아내는지 확인했다.

- 변이 A: `nextLatencyMs`를 `minLatencyMs + random()*(max-min)` →
  `random() * maxLatencyMs`로 바꿈 (= 흔한 실수. 0ms가 나와 "200~800ms" 요구 위반)
  → **2개 실패**: `기본 설정에서 항상 200~800ms 범위다`, `난수가 0이어도 하한(200ms)을 지킨다`
- 변이 B: `store.readAll()`의 방어 복사(`.map(a => ({...a}))`)를 제거
  → **1개 실패**: `밖으로 나간 객체를 변형해도 저장소가 오염되지 않는다`

둘 다 잡혔으므로 해당 테스트는 유효하다. 변이 후 원복하고 전체 재실행해 17/17 통과 확인.

**3) 실패 판정 시점을 "쓰기 전"으로 한정한 것 — AI 제안 수용, 다만 이유를 따져봤다**

- mock 서버가 실패할 때 (a) 요청이 서버에 닿지 못함 (b) 서버는 처리했는데 응답이 유실됨
  두 가지가 가능하다. AI 초안은 (a)였다.
- **검증**: (b)를 흉내내면 클라이언트가 반영 여부를 알 방법이 없어 낙관적 롤백이
  정답 없는 문제가 된다. 과제 요구는 "실패 시 원상 복구"이므로 (a)가 요구에 맞다.
- **채택**하고 `api.ts`의 `simulateNetwork` 주석에 이 판단을 남겼다.
  `실패한 요청은 서버 상태를 바꾸지 않는다` 테스트로 못 박아뒀다.

**4) 직접 확인한 나머지 동작**

`npm run test` 로 실제 검증한 항목:
- 같은 `(seed, count)` → 결과 완전 일치 / 다른 seed → 불일치
- 기본 설정에서 지연이 2,000회 모두 200~800ms 범위
- `failureRate: 1` → 100회 모두 실패, `0` → 100회 모두 성공
- 기본 실패율 20,000회 표본에서 0.14~0.16 (요구 "약 15%") 
- 이동 성공 시 `version` +1, `stageHistory` +1, `from`/`to` 정확
- **이동 결과가 localStorage에 실제로 쓰이는지** — `localStorage`를 직접 파싱해서 확인.
  (mock API가 메모리만 갱신하고 영속화를 빼먹는 건 흔한 누락이라 별도 테스트로 고정)
- 낡은 `expectedVersion` → `ConflictError`, `status 409`, `current`에 서버 최신 상태 포함
- 같은 단계로의 이동은 `version`을 올리지 않음
- 실패한 이동 후 서버 상태 불변

**5) 계획에서 벗어난 점 (의도적)**

- `stageHistory`를 커밋 9(상세 패널)에서 추가하려던 계획을 **커밋 1로 앞당겼다.**
  이유: 1,000건이 이미 localStorage에 쓰인 뒤 필드를 추가하면 스키마 마이그레이션이
  필요해진다. `moveApplicantStage`가 유일한 변경 지점이니 처음부터 기록하는 게 싸다.
  대신 스키마 키에 버전을 박아(`hpb.applicants.v1`) 나중에 바꿀 때 옛 데이터를
  버릴 수 있게 했다.
- mock API 테스트를 커밋 7(테스트 커밋)까지 미루지 않고 이 커밋에 포함했다.
  mock 서버가 이후 모든 기능의 토대이므로, 여기가 틀리면 뒤가 전부 틀린다.

**미검증**: 브라우저에서의 실제 새로고침 유지. (다음 커밋에서 UI가 붙으면 확인)

---

## [board-layout] 5단계 컬럼 보드

### 프롬프트 1

```
보드 레이아웃을 만든다. src/mocks의 mock API를 쓴다.

- ApplicantsProvider: useReducer + Context.
  state = { status: 'idle'|'loading'|'error'|'ready', byId, allIds, error }
  액션은 지금 LOAD_START / LOAD_SUCCESS / LOAD_ERROR 만.
  정규화(byId + allIds)로 저장해라. 나중에 카드 단위 낙관적 업데이트를 할 거라서
  배열 순회로 찾는 구조면 안 된다.
- Board: 5개 컬럼 가로 배치. 데스크톱 5열, 좁아지면 가로 스크롤.
- Column: 제목 + 건수 배지 + 세로 스크롤 영역. 마크업은 ul/li 시맨틱으로.
- 단계 라벨/색/순서는 한 곳(constants)에서 관리.
  순서는 서류검토 → 면접 → 처우협의 → 최종합격 → 불합격.
- 지금은 카드 내용 없이 자리만. 로딩/에러/빈 상태는 다음 단계다.

Context 값은 state와 dispatch를 분리해서 노출해라. 리렌더 범위 때문에.
```

### AI 출력 요지

`domain/stages.ts`(라벨·색·순서), `features/applicants/`에 `types.ts`·`reducer.ts`·
`ApplicantsProvider.tsx`, `features/board/`에 `Board.tsx`·`Column.tsx`·`selectors.ts`.
Context를 `StateContext` / `ActionsContext` 둘로 쪼개고, 후자에는 `reload`만 노출.
셀렉터는 컬럼별 `filter` 5회 대신 전체를 한 번 훑어 단계별로 갈라 담는 방식(`groupIdsByStage`).

### 리뷰 / 검증

**1) 데이터는 있는데 status가 error인 상태가 실제로 발생했다 — 낡은 응답이 최신 상태를 덮어씀**

- **무엇이 문제였나**: 브라우저에서 처음 띄웠을 때 컬럼 건수는 정상(합계 200)인데
  헤더의 "지원자 200명"이 안 나왔다. 즉 데이터는 채워졌는데 `status !== 'ready'`였다.
- **어떻게 알아냈나**:
  1. DOM을 직접 조회해 컬럼 합계가 200임을 확인 (`sum: 200`) → 데이터는 들어왔다.
  2. 헤더 `<p>` 내용이 빈 문자열임을 확인 → 조건 `status === 'ready'`가 거짓이다.
  3. 상태를 눈으로 볼 수 없어서 루트 div에 `data-load-status` 속성을 붙여 노출시켰다.
  4. 리듀서를 다시 읽어보니 `LOAD_ERROR`가 `byId`를 지우지 않는다(의도한 것).
     그래서 "성공 후 실패"가 겹치면 데이터 + error 조합이 만들어진다.
- **원인**: React StrictMode가 개발 모드에서 effect를 두 번 실행한다.
  → `listApplicants()`가 2회 나가고, 각각 15% 확률로 실패한다.
  → 1번이 성공하고 2번이 실패하면 데이터는 남고 status만 error가 된다.
  (약 28% 확률로 뭔가 어긋난다. 실제로 첫 실행에 바로 걸렸다.)
- **어떻게 고쳤나**: AI 초안에 없던 **요청 시퀀스 가드**를 넣었다.
  `loadSeq` ref를 두고, 응답이 도착했을 때 자기 순번이 최신이 아니면 dispatch를 버린다.
  이제 겹친 로드 중 **마지막 요청의 결과만** 반영된다.
- **재검증**: 4회 재적재 + `?count=1000` 전환까지 모두 `status: ready`,
  합계는 각각 200 / 1000으로 정확했다.
- **남은 판단**: 시퀀스 가드를 넣어도 "마지막 요청이 실패하면 error"는 여전히 맞는 동작이다.
  다만 **이미 데이터가 있는데 재적재만 실패한 경우 보드를 지워버리는 건 나쁜 UX**다.
  이건 다음 커밋(loading-error-empty)에서 "데이터가 없을 때만 전체 에러 화면,
  있으면 비차단 배너"로 처리한다.

> 이 문제는 커밋 11(경쟁 상태)에서 다룰 "늦게 온 응답이 최신 상태를 덮어쓴다"와
> **같은 종류**다. 카드 이동에서만 생기는 줄 알았는데 초기 로드에서 먼저 터졌다.

**2) 컬럼별 `filter` 5회를 한 번 순회로 바꿨다**

- AI 초안은 컬럼마다 `allIds.filter(id => byId[id].stage === stage)`였다.
  1,000건 × 5컬럼 = 5,000회 순회 + 배열 5개 생성이 매 렌더마다 일어난다.
- `groupIdsByStage`로 전체를 한 번만 훑도록 바꾸고 `useMemo`로 감쌌다.
- 아직 체감 성능 문제는 없지만 커밋 8(검색/필터)에서 매 입력마다 재계산되는 자리라
  미리 정리해 두는 게 맞다고 판단했다.

**3) 브라우저에서 직접 확인한 것**

- 컬럼 순서: `서류검토 → 면접 → 처우협의 → 최종합격 → 불합격` (constants 순서와 일치)
- 컬럼 건수 합 = 전체 건수 (200 / 1000 둘 다)
- `aria-label`이 `"서류검토 89명"` 형태로 단계명 + 건수를 담고 있음
- `?count=1000` 전환 시 localStorage가 재시드되고 합계 1000
- 이 시점 DOM 노드 수 **46개** (카드가 아직 없으므로) — 커밋 13 가상화 비교용 기준선은
  카드가 붙는 다음 커밋에서 다시 측정한다.

**미검증**: `state`/`actions` Context 분리가 실제로 리렌더를 줄이는지.
(Profiler 측정은 카드가 붙고 필터가 생기는 커밋 8에서 의미가 있다)
