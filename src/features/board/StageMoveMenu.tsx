import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Ref } from 'react'
import type { Stage } from '../../domain/applicant'
import { STAGE_META, STAGE_ORDER } from '../../domain/stages'

export interface StageMoveMenuHandle {
  open: () => void
}

interface StageMoveMenuProps {
  currentStage: Stage
  /** 이동 요청이 진행 중이면 버튼 라벨로 알린다. 조작은 막지 않는다(큐가 처리한다). */
  isPending: boolean
  onSelect: (stage: Stage) => void
  /** 스크린리더가 "누구를" 옮기는지 알 수 있게 이름을 받는다. */
  applicantName: string
  /** roving tabindex. 컬럼의 Tab 스톱 카드만 0을 받는다. */
  tabIndex: number
  ref?: Ref<StageMoveMenuHandle>
}

/** 메뉴 폭(w-32). 오른쪽 정렬 계산에 쓴다. */
const MENU_WIDTH = 128
/** 아래로 펼치기에 필요한 최소 여유. 이보다 좁으면 위로 펼친다. */
const MIN_SPACE_BELOW = 190
const GAP = 4

interface Anchor {
  /** 트리거 상단 (뷰포트 기준) */
  top: number
  /** 트리거 하단 (뷰포트 기준) */
  bottom: number
  /** 메뉴 왼쪽 좌표. 트리거 오른쪽 끝에 우측 정렬되도록 계산해 둔다. */
  left: number
}

/**
 * 뷰포트 폭(`window.innerWidth`)에 의존하지 않는다.
 *
 * 처음에는 `right: innerWidth - rect.right` 로 우측 정렬했는데, 검증 중
 * `innerWidth`가 0으로 보고되는 환경을 만나 메뉴가 화면 왼쪽 밖으로 튀어나갔다.
 * 트리거의 rect만으로 계산하면 그런 환경 차이에 영향받지 않고, 스크롤바 폭이나
 * 확대/축소로 `innerWidth`와 레이아웃 폭이 어긋나는 경우에도 안전하다.
 */
function readAnchor(element: HTMLElement): Anchor {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: Math.max(GAP, rect.right - MENU_WIDTH),
  }
}

/** 뷰포트 높이. 알 수 없으면 0을 돌려주고, 그 경우 뒤집지 않는다. */
function viewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight || 0
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
 *
 * ## 왜 포털 + `position: fixed` 인가
 *
 * 처음에는 카드 안에서 `absolute` + `z-index`로 띄웠는데, 가상 스크롤을 붙인 뒤
 * **메뉴가 뒤 카드 밑으로 깔리고 컬럼 경계에서 잘렸다.** 두 증상의 원인은 하나다:
 *
 * 1. 가상 스크롤이 각 항목 `li`에 `transform`을 건다 → **stacking context가 생긴다.**
 *    메뉴의 `z-index`는 그 안에 갇히고, 형제 `li`들은 `z-index: auto`라
 *    DOM 순서대로 페인트되어 **뒤 카드가 메뉴 위로** 올라온다.
 * 2. 컬럼이 `overflow-y-auto`라 카드 밖으로 나간 메뉴가 **잘린다.**
 *
 * `z-index`를 올리는 것으로는 2번이 남는다. 두 제약 모두 조상 요소가 만든 것이므로,
 * 조상 밖으로 나가는 것이 정답이다 — `document.body`로 포털을 보내고 뷰포트 좌표로 배치한다.
 */
export function StageMoveMenu({
  currentStage,
  isPending,
  onSelect,
  applicantName,
  tabIndex,
  ref,
}: StageMoveMenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const menuId = useId()

  const isOpen = anchor !== null

  /**
   * 위치는 **여는 시점의 이벤트 핸들러에서** 계산한다.
   * effect 안에서 측정 후 `setState` 하면 렌더가 한 번 더 돌고
   * ESLint `react-hooks/set-state-in-effect`에도 걸린다.
   */
  const openMenu = useCallback(() => {
    const trigger = triggerRef.current
    if (trigger === null) return
    setAnchor(readAnchor(trigger))
  }, [])

  const close = useCallback((restoreFocus: boolean) => {
    setAnchor(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useImperativeHandle(ref, () => ({ open: openMenu }))

  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      // 메뉴가 포털로 나가 있으므로 컨테이너만 검사하면 메뉴 클릭이 "바깥"으로 잡힌다.
      // 그러면 mousedown 단계에서 닫혀 버려 항목의 click이 아예 발생하지 않는다.
      if (containerRef.current?.contains(target) === true) return
      if (listRef.current?.contains(target) === true) return
      close(false)
    }

    /** 스크롤/리사이즈로 트리거가 움직이면 메뉴도 따라간다. */
    function reposition() {
      const trigger = triggerRef.current
      if (trigger === null) return
      setAnchor(readAnchor(trigger))
    }

    document.addEventListener('mousedown', onPointerDown)
    // capture: 컬럼 내부 스크롤은 window로 버블링되지 않는다.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
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

  /**
   * 아래 공간이 부족하면 위로 펼친다.
   *
   * 메뉴 높이를 재서 판단하면 "렌더 → 측정 → 재배치"로 한 프레임 깜빡인다.
   * 항목 수가 고정(단계 수)이라 필요한 여유를 상수로 두는 편이 안정적이다.
   */
  const available = viewportHeight()
  const openUpward = anchor !== null && available > 0 && available - anchor.bottom < MIN_SPACE_BELOW

  const menu =
    anchor === null ? null : (
      <ul
        ref={listRef}
        id={menuId}
        role="menu"
        aria-label={`${applicantName} 이동할 단계`}
        onKeyDown={onMenuKeyDown}
        style={{
          position: 'fixed',
          left: anchor.left,
          width: MENU_WIDTH,
          ...(openUpward ? { bottom: available - anchor.top + GAP } : { top: anchor.bottom + GAP }),
        }}
        className="z-50 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
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
    )

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        tabIndex={tabIndex}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`${applicantName} 단계 이동`}
        onClick={() => {
          if (isOpen) close(false)
          else openMenu()
        }}
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-600"
      >
        {isPending ? '이동 중…' : '이동'}
      </button>

      {/*
        포털로 `document.body`에 붙인다. React 트리 기준으로는 여전히 이 카드의 자식이라
        키보드 이벤트 전파와 Context 구독은 그대로 동작한다.
      */}
      {menu !== null && createPortal(menu, document.body)}
    </div>
  )
}
