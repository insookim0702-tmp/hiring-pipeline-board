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
