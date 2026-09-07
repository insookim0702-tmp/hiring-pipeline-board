import { useToastApi, useToasts, type ToastTone } from './ToastProvider'

const TONE_CLASS: Record<ToastTone, string> = {
  error: 'border-rose-300 bg-rose-50 text-rose-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
}

/**
 * 토스트 표시 영역.
 *
 * 컨테이너를 **항상 DOM에 두고** 안쪽 내용만 바뀌게 한다. 토스트와 함께
 * live region을 새로 마운트하면 스크린리더가 읽지 않는 경우가 많다.
 */
export function ToastViewport() {
  const toasts = useToasts()
  const { dismiss } = useToastApi()

  return (
    <div
      /*
       * 여기에는 aria-live를 두지 않는다.
       * 안내는 AnnouncerProvider가 단독으로 담당한다 — 토스트와 live region이
       * 각각 알리면 같은 사건이 두 번 낭독된다. 이 컴포넌트는 시각 표현만 맡는다.
       */
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-3.5 py-2.5 shadow-lg ${TONE_CLASS[toast.tone]}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{toast.title}</p>
            {toast.description !== undefined && (
              <p className="mt-0.5 text-xs opacity-90">{toast.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              dismiss(toast.id)
            }}
            aria-label="알림 닫기"
            className="shrink-0 rounded p-0.5 text-base leading-none opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
