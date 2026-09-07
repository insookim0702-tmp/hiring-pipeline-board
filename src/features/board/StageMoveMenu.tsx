import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import type { Stage } from '../../domain/applicant'
import { STAGE_META, STAGE_ORDER } from '../../domain/stages'

export interface StageMoveMenuHandle {
  open: () => void
}

interface StageMoveMenuProps {
  currentStage: Stage
  /** 이동 요청이 진행 중이면 메뉴를 잠근다. */
  isPending: boolean
  onSelect: (stage: Stage) => void
  /** 스크린리더가 "누구를" 옮기는지 알 수 있게 이름을 받는다. */
  applicantName: string
  /** roving tabindex. 컬럼의 Tab 스톱 카드만 0을 받는다. */
  tabIndex: number
  ref?: Ref<StageMoveMenuHandle>
}

/**
 * 단계 이동 메뉴.
 *
 * 드래그앤드롭 대신 명시적 액션을 택했다(과제에서 택1 허용).
 * 요약: DnD를 택하면 키보드 대체 경로를 따로 구현해야 하는데, 버튼 방식은
 * 그게 기본으로 따라온다. 자세한 이유는 DECISIONS.md.
 *
 * 키보드: 카드에서 `M`으로 열고, 메뉴 안에서 ↑↓ 탐색 / Enter 선택 / Esc 취소.
 * 포커스를 실제로 옮기는 방식(`aria-activedescendant`가 아니라)으로 일관되게 처리한다.
 */
export function StageMoveMenu({
  currentStage,
  isPending,
  onSelect,
  applicantName,
  tabIndex,
  ref,
}: StageMoveMenuProps) {
  const [isOpenRequested, setIsOpenRequested] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const menuId = useId()

  /**
   * pending 중에는 열지 않는다.
   *
   * 처음에는 `useEffect`로 `isPending`이 되면 `setIsOpen(false)`을 호출했는데
   * ESLint `react-hooks/set-state-in-effect`가 잡았다. 실제로 불필요한 렌더를
   * 한 번 더 유발하는 코드였다. 상태를 동기화하는 대신 **파생값으로 계산**한다.
   */
  const isOpen = isOpenRequested && !isPending

  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpenRequested(true)
    },
  }))

  const close = useCallback((restoreFocus: boolean) => {
    setIsOpenRequested(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node) === false) close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [isOpen, close])

  // 열리면 첫 항목으로 포커스를 옮긴다. 그래야 ↑↓과 Enter가 곧바로 동작한다.
  useEffect(() => {
    if (!isOpen) return
    const first = listRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not([disabled])',
    )
    first?.focus()
  }, [isOpen])

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ??
        [],
    )
    if (items.length === 0) return

    event.preventDefault()
    // 방향키가 보드의 카드 이동 핸들러까지 올라가지 않게 막는다.
    event.stopPropagation()

    const currentIndex = items.findIndex((item) => item === document.activeElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (currentIndex + step + items.length) % items.length
    items[nextIndex]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={isPending}
        tabIndex={tabIndex}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`${applicantName} 단계 이동`}
        onClick={() => {
          setIsOpenRequested((open) => !open)
        }}
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600 disabled:opacity-50"
      >
        {isPending ? '이동 중…' : '이동'}
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={`${applicantName} 이동할 단계`}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {STAGE_ORDER.map((stage) => {
            const isCurrent = stage === currentStage
            return (
              <li key={stage} role="none">
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={isCurrent}
                  onClick={() => {
                    close(true)
                    onSelect(stage)
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 focus:bg-sky-50 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-600 disabled:cursor-default disabled:bg-transparent disabled:text-slate-300"
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${STAGE_META[stage].accentClass}`}
                  />
                  {STAGE_META[stage].label}
                  {isCurrent && <span className="ml-auto text-[10px] text-slate-400">현재</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
