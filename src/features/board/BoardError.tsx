interface BoardErrorProps {
  message: string
  onRetry: () => void
}

/**
 * 최초 로드 실패 — 보여줄 데이터가 아예 없을 때. 보드 대신 이 패널이 나온다.
 *
 * `role="alert"`을 붙여 스크린리더가 즉시 읽게 한다.
 *
 * 재시도 중 상태는 여기서 표현하지 않는다. 재시도를 누르면 status가 loading으로 바뀌어
 * 이 패널 자체가 스켈레톤으로 교체되기 때문이다. (진행 표시는 헤더가 담당)
 */
export function BoardError({ message, onRetry }: BoardErrorProps) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center p-6">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-6 py-8 text-center"
      >
        <p className="text-sm font-semibold text-rose-900">지원자 목록을 불러오지 못했습니다</p>
        <p className="text-xs text-rose-800">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

/**
 * 재적재 실패 — 화면에 이미 데이터가 있을 때.
 *
 * 이 경우 보드를 지우고 에러 화면으로 바꾸면 사용자가 보고 있던 걸 빼앗는 셈이다.
 * (mock API가 15% 실패하므로 재적재 실패는 자주 일어난다)
 * 그래서 비차단 배너로만 알린다.
 */
export function ReloadErrorBanner({ message, onRetry }: BoardErrorProps) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2"
    >
      <p className="text-xs text-amber-900">
        목록을 새로 불러오지 못했습니다. 화면의 내용이 최신이 아닐 수 있습니다. ({message})
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
      >
        다시 시도
      </button>
    </div>
  )
}
