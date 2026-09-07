import { useEffect, useId, useRef, useState } from 'react'
import { useFocusTrap } from '../lib/useFocusTrap'

const SHORTCUTS: ReadonlyArray<{ keys: string; description: string }> = [
  { keys: '← →', description: '이전 / 다음 단계 컬럼으로 이동' },
  { keys: '↑ ↓', description: '같은 컬럼 안에서 위 / 아래 카드로 이동' },
  { keys: 'Home / End', description: '컬럼의 첫 / 마지막 카드' },
  { keys: 'Enter, Space', description: '지원자 상세 패널 열기' },
  { keys: 'M', description: '단계 이동 메뉴 열기' },
  { keys: '↑ ↓, Enter', description: '(메뉴에서) 단계 선택' },
  { keys: 'Esc', description: '메뉴 / 상세 패널 닫기' },
  { keys: 'Ctrl / Cmd + Z', description: '마지막 단계 이동 되돌리기' },
  { keys: '?', description: '이 도움말 열기 / 닫기' },
]

/**
 * 키보드 조작 안내.
 *
 * 단축키를 만들어 두고 알리지 않으면 없는 것과 같다. 헤더 버튼과 `?` 키
 * 두 경로로 열 수 있게 했다.
 */
export function KeyboardHelp() {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // 입력 중에는 '?'가 단축키가 아니라 문자다.
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (event.key === '?' && isTyping !== true) {
        event.preventDefault()
        setIsOpen((open) => !open)
        return
      }
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useFocusTrap(dialogRef, isOpen)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
        }}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        키보드 조작
        <kbd className="ml-1.5 rounded border border-slate-300 bg-slate-50 px-1 font-sans text-[10px]">
          ?
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/20 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900">
                키보드 조작
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              >
                닫기
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-xs">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="col-span-2 grid grid-cols-subgrid">
                  <dt>
                    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-700">
                      {shortcut.keys}
                    </kbd>
                  </dt>
                  <dd className="text-slate-700">{shortcut.description}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-[11px] text-slate-500">
              드래그앤드롭 대신 명시적 이동 메뉴를 사용하므로, 모든 조작이 키보드만으로 가능합니다.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
