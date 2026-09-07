import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react'
import type { Stage } from '../../domain/applicant'
import { STAGE_ORDER } from '../../domain/stages'
import type { StageGroups } from './selectors'

/** 카드 DOM을 찾는 규약. 카드가 `data-card-id`를 달고 있다는 전제. */
/** 렌더되어 있으면 포커스를 주고 true. 가상 스크롤로 화면 밖이면 false. */
function focusCard(container: HTMLElement | null, id: string): boolean {
  const target = container?.querySelector<HTMLElement>(`[data-card-id="${id}"] [data-card-focus]`)
  if (target == null) return false
  target.focus()
  return true
}

interface CardLocation {
  stage: Stage
  index: number
  id: string
}

function locate(groups: StageGroups, id: string | null): CardLocation | null {
  if (id === null) return null
  for (const stage of STAGE_ORDER) {
    const index = groups[stage].findIndex((applicant) => applicant.id === id)
    if (index !== -1) return { stage, index, id }
  }
  return null
}

export interface BoardKeyboardNav {
  /** 컬럼별 Tab 스톱이 되는 카드 id. 이 카드만 tabIndex 0을 갖는다. */
  tabStopByStage: Partial<Record<Stage, string>>
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  /** 카드가 포커스를 받았을 때 알려준다. 마우스 클릭으로 옮겨간 포커스도 반영. */
  onCardFocus: (id: string) => void
}

/**
 * 보드의 방향키 이동 + roving tabindex.
 *
 * 왜 roving tabindex인가: 카드마다 `tabIndex=0`이면 1,000건에서 Tab을 1,000번
 * 눌러야 보드를 지나갈 수 있다. 컬럼당 하나만 Tab에 노출하고
 * 컬럼 내부 이동은 방향키로 처리한다(WAI-ARIA의 grid/listbox 관용구).
 *
 * - ← → : 컬럼 간 이동 (같은 행 위치를 최대한 유지, 빈 컬럼은 건너뜀)
 * - ↑ ↓ : 컬럼 내 이동 (양 끝에서는 멈춘다 — 다음 컬럼으로 넘겨버리면
 *          "끝에 도달했다"는 감각을 잃는다)
 * - Home / End : 컬럼의 처음 / 끝
 *
 * 파생값에 `useMemo`를 쓰지 않는다. 계산이 단계 5회 루프 수준이고, 결과는 카드에
 * **불리언으로 좁혀서** 넘기므로 참조가 매 렌더 바뀌어도 카드 memo에 영향이 없다.
 * (감쌌더니 React Compiler가 "기존 메모이제이션을 보존할 수 없다"며 최적화를
 *  건너뛴다고 경고했다 — 콜백 안의 early return 때문. 규칙을 끄는 대신
 *  애초에 불필요했던 메모를 없애는 쪽을 골랐다)
 */
export function useBoardKeyboardNav(
  groups: StageGroups,
  containerRef: RefObject<HTMLDivElement | null>,
  /**
   * 대상 카드를 화면 안으로 스크롤한다.
   *
   * 가상 스크롤이 들어온 뒤로는 화면 밖 카드가 **DOM에 아예 없다.**
   * 먼저 스크롤해 렌더시키지 않으면 `focus()`가 아무 일도 하지 않고
   * 포커스가 `<body>`로 떨어진다.
   */
  scrollToCard: (stage: Stage, index: number) => void,
): BoardKeyboardNav {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  /** 아직 렌더되지 않아 포커스를 주지 못한 카드. 렌더되면 layout effect가 처리한다. */
  const pendingFocusRef = useRef<string | null>(null)

  const location = locate(groups, focusedId)

  const tabStopByStage: Partial<Record<Stage, string>> = {}
  for (const stage of STAGE_ORDER) {
    const preferred = location?.stage === stage ? location.id : undefined
    const id = preferred ?? groups[stage][0]?.id
    if (id !== undefined) tabStopByStage[stage] = id
  }

  const moveTo = useCallback(
    (stage: Stage, index: number, currentGroups: StageGroups) => {
      const column = currentGroups[stage]
      if (column.length === 0) return
      const clamped = Math.max(0, Math.min(index, column.length - 1))
      const next = column[clamped]
      if (next === undefined) return

      setFocusedId(next.id)

      // 이미 렌더되어 있으면 곧바로 포커스가 간다.
      if (focusCard(containerRef.current, next.id)) {
        pendingFocusRef.current = null
        return
      }

      /**
       * 화면 밖 카드는 가상 스크롤 때문에 **DOM에 아예 없다.**
       * 스크롤을 요청해 두고, 실제로 렌더된 뒤에 포커스한다.
       *
       * 처음에는 `requestAnimationFrame`을 한두 번 기다린 뒤 포커스했는데
       * 그건 "몇 프레임 뒤엔 렌더돼 있겠지"라는 추측이다. 실제로 40장짜리 컬럼에서
       * End를 눌렀을 때 프레임이 모자라 포커스가 `<body>`로 떨어졌다.
       * 프레임을 세지 않고 "렌더된 순간"에 반응하도록 바꿨다.
       */
      pendingFocusRef.current = next.id
      scrollToCard(stage, clamped)
    },
    [containerRef, scrollToCard],
  )

  /**
   * 대기 중인 포커스 요청을 처리한다.
   *
   * 의존성 배열이 없다 = 매 렌더 뒤에 확인한다. 가상 스크롤이 목표 카드를
   * 그리는 순간(스크롤 이벤트 → 재렌더) 바로 포커스가 간다.
   * 페인트 전에 끝내야 포커스 링이 한 프레임 튀지 않으므로 layout effect다.
   */
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current
    if (pending === null) return
    if (focusCard(containerRef.current, pending)) pendingFocusRef.current = null
  })

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const key = event.key
      const isNavKey =
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'Home' ||
        key === 'End'
      if (!isNavKey) return

      // 메뉴가 열려 있으면 방향키는 메뉴 것이다.
      if ((event.target as HTMLElement).closest('[role="menu"]') !== null) return

      const firstStage = STAGE_ORDER[0]
      if (firstStage === undefined) return

      // 아직 포커스가 없으면 첫 컬럼의 첫 카드부터 시작한다.
      const current = location ?? { stage: firstStage, index: 0, id: '' }

      // 방향키가 컬럼/페이지 스크롤까지 먹지 않게 막는다.
      event.preventDefault()

      if (key === 'ArrowUp') {
        moveTo(current.stage, current.index - 1, groups)
      } else if (key === 'ArrowDown') {
        moveTo(current.stage, current.index + 1, groups)
      } else if (key === 'Home') {
        moveTo(current.stage, 0, groups)
      } else if (key === 'End') {
        moveTo(current.stage, groups[current.stage].length - 1, groups)
      } else {
        const step = key === 'ArrowLeft' ? -1 : 1
        const stageIndex = STAGE_ORDER.indexOf(current.stage)
        // 빈 컬럼은 건너뛴다. 포커스를 줄 카드가 없기 때문.
        for (let i = stageIndex + step; i >= 0 && i < STAGE_ORDER.length; i += step) {
          const candidate = STAGE_ORDER[i]
          if (candidate !== undefined && groups[candidate].length > 0) {
            moveTo(candidate, current.index, groups)
            break
          }
        }
      }
    },
    [location, groups, moveTo],
  )

  const onCardFocus = useCallback((id: string) => {
    setFocusedId(id)
  }, [])

  return { tabStopByStage, onKeyDown, onCardFocus }
}
