import { KeyboardHelp } from './components/KeyboardHelp'
import { Board } from './features/board/Board'
import {
  ApplicantsProvider,
  useApplicantsActions,
  useApplicantsState,
} from './features/applicants/ApplicantsProvider'
import { ApplicantDetailPanel } from './features/detail/ApplicantDetailPanel'
import { AnnouncerProvider } from './features/feedback/AnnouncerProvider'
import { ToastProvider } from './features/feedback/ToastProvider'
import { ToastViewport } from './features/feedback/ToastViewport'
import { FiltersProvider } from './features/filters/FiltersProvider'
import { SelectionProvider, useSelectedId } from './features/selection/SelectionProvider'

function AppHeader() {
  const { allIds, status } = useApplicantsState()
  const { reload } = useApplicantsActions()
  const isLoading = status === 'loading'

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="text-base font-semibold text-slate-900">채용 파이프라인 보드</h1>

      <p className="text-xs text-slate-500">
        {status === 'ready' ? `지원자 ${allIds.length}명` : ''}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <KeyboardHelp />
        {/*
          진행 표시를 헤더가 담당한다. 에러 패널 안에 두면, 재시도를 눌러 status가
          loading으로 바뀌는 순간 그 패널 자체가 언마운트되어 표시될 기회가 없다.
        */}
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-60"
        >
          {isLoading ? '불러오는 중…' : '다시 불러오기'}
        </button>
      </div>
    </header>
  )
}

function AppShell() {
  const { status } = useApplicantsState()
  const selectedId = useSelectedId()
  const isPanelOpen = selectedId !== null

  return (
    <div
      // 로드 상태를 DOM에 노출해 둔다. 브라우저에서 상태 전이를 직접 확인할 때 쓴다.
      data-load-status={status}
      className="flex h-dvh bg-white text-slate-900"
    >
      {/*
        패널이 aria-modal을 선언하는 동안 배경은 상호작용에서 제외한다.
        `inert`는 시각적으로는 그대로 두면서 포커스·클릭·접근성 트리에서만 빼주므로,
        "보드 문맥을 유지한다"는 패널 선택 이유를 깨지 않는다.
      */}
      <div inert={isPanelOpen} className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <Board />
      </div>

      {selectedId !== null && <ApplicantDetailPanel key={selectedId} applicantId={selectedId} />}
    </div>
  )
}

export function App() {
  return (
    // ToastProvider가 바깥이다. ApplicantsProvider가 실패 피드백을 띄우려면
    // useToastApi()를 쓸 수 있어야 한다.
    <AnnouncerProvider>
      <ToastProvider>
        <ApplicantsProvider>
          <FiltersProvider>
            <SelectionProvider>
              <AppShell />
            </SelectionProvider>
          </FiltersProvider>
          <ToastViewport />
        </ApplicantsProvider>
      </ToastProvider>
    </AnnouncerProvider>
  )
}
