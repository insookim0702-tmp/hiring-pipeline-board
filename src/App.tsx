import { Board } from './features/board/Board'
import { ApplicantsProvider, useApplicantsState } from './features/applicants/ApplicantsProvider'

function AppHeader() {
  const { allIds, status } = useApplicantsState()

  return (
    <header className="flex shrink-0 items-baseline gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="text-base font-semibold text-slate-900">채용 파이프라인 보드</h1>
      <p className="text-xs text-slate-500">
        {status === 'ready' ? `지원자 ${allIds.length}명` : ''}
      </p>
    </header>
  )
}

function AppShell() {
  const { status } = useApplicantsState()

  return (
    <div
      // 로드 상태를 DOM에 노출해 둔다. 브라우저에서 상태 전이를 직접 확인할 때 쓴다.
      data-load-status={status}
      className="flex h-dvh flex-col bg-white text-slate-900"
    >
      <AppHeader />
      <Board />
    </div>
  )
}

export function App() {
  return (
    <ApplicantsProvider>
      <AppShell />
    </ApplicantsProvider>
  )
}
