import { useEffect, useId, useRef, useState } from 'react'
import type { Stage } from '../../domain/applicant'
import { STAGE_META, STAGE_ORDER } from '../../domain/stages'

interface StageMoveMenuProps {
  currentStage: Stage
  /** 이동 요청이 진행 중이면 메뉴를 잠근다. */
  isPending: boolean
  onSelect: (stage: Stage) => void
  /** 스크린리더가 "누구를" 옮기는지 알 수 있게 이름을 받는다. */
  applicantName: string
}

/**
 * 단계 이동 메뉴.
 *
 * 드래그앤드롭 대신 명시적 액션을 택했다(과제에서 택1 허용).
 * 이유는 DECISIONS.md에 정리 — 요약하면 DnD를 택하면 키보드 대체 경로를 따로
 * 구현해야 하는데, 버튼 방식은 그게 기본으로 따라온다.
 *
 * 키보드 조작(방향키 탐색, roving tabindex 등)은 커밋 10에서 제대로 붙인다.
 * 지금은 마우스 조작과 Esc 닫기까지만.
 */
export function StageMoveMenu({
  currentStage,
  isPending,
  onSelect,
  applicantName,
}: StageMoveMenuProps) {
  const [isOpenRequested, setIsOpenRequested] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  /**
   * pending 중에는 열지 않는다.
   *
   * 처음에는 `useEffect`로 `isPending`이 되면 `setIsOpen(false)`을 호출했는데
   * ESLint `react-hooks/set-state-in-effect`가 잡았다. 실제로 불필요한 렌더를
   * 한 번 더 유발하는 코드였다. 상태를 동기화하는 대신 **파생값으로 계산**한다.
   */
  const isOpen = isOpenRequested && !isPending

  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node) === false) setIsOpenRequested(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpenRequested(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isPending}
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
          id={menuId}
          role="menu"
          aria-label={`${applicantName} 이동할 단계`}
          className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {STAGE_ORDER.map((stage) => {
            const isCurrent = stage === currentStage
            return (
              <li key={stage} role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={isCurrent}
                  onClick={() => {
                    setIsOpenRequested(false)
                    onSelect(stage)
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none disabled:cursor-default disabled:bg-transparent disabled:text-slate-300"
                >
                  <span
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
