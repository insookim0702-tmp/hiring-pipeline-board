import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

interface SelectionApi {
  open: (id: string) => void
  close: () => void
}

const SelectedIdContext = createContext<string | null | undefined>(undefined)
const SelectionApiContext = createContext<SelectionApi | null>(null)

/**
 * 상세 패널이 어떤 카드를 열고 있는지.
 *
 * 카드가 `open`만 쓰고 `selectedId` 변화에는 리렌더되지 않아야 하므로
 * 여기서도 값과 API를 다른 Context로 나눈다. (카드 1,000장의 memo 유지)
 */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  /**
   * 패널을 연 요소. 닫을 때 여기로 포커스를 되돌린다.
   * 열 때 `document.activeElement`를 기록하는 방식이라 마우스로 열었든
   * 키보드로 열었든 같은 경로를 탄다.
   */
  const openerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((id: string) => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedId(id)
  }, [])

  /** 닫힌 뒤 포커스를 되돌려야 하는 요소. */
  const restoreTargetRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    restoreTargetRef.current = openerRef.current
    openerRef.current = null
    setSelectedId(null)
  }, [])

  /**
   * 포커스 복귀는 **DOM이 갱신된 뒤에** 해야 한다.
   *
   * 처음에는 `close()` 안에서 `setSelectedId(null)` 직후에 `opener.focus()`를 호출했는데
   * 포커스가 `<body>`로 떨어졌다. 그 시점에는 아직 리렌더가 일어나지 않아
   * 배경 보드가 여전히 `inert` 상태이고, **inert 서브트리 안의 요소는 focus()가 무시된다.**
   * 그래서 `useLayoutEffect`로 옮겼다 — DOM에서 inert가 제거된 뒤,
   * 페인트 전에 실행되므로 포커스 이동이 화면에 튀지 않는다.
   */
  useLayoutEffect(() => {
    if (selectedId !== null) return
    const target = restoreTargetRef.current
    if (target === null) return
    restoreTargetRef.current = null
    // 가상 스크롤로 화면 밖으로 나가는 등, 이미 DOM에서 사라졌을 수 있다.
    if (document.contains(target)) target.focus()
  }, [selectedId])

  const api = useMemo<SelectionApi>(() => ({ open, close }), [open, close])

  return (
    <SelectionApiContext.Provider value={api}>
      <SelectedIdContext.Provider value={selectedId}>{children}</SelectedIdContext.Provider>
    </SelectionApiContext.Provider>
  )
}

export function useSelectedId(): string | null {
  const value = useContext(SelectedIdContext)
  if (value === undefined) throw new Error('useSelectedId는 SelectionProvider 안에서만 쓸 수 있다.')
  return value
}

export function useSelectionApi(): SelectionApi {
  const api = useContext(SelectionApiContext)
  if (api === null) throw new Error('useSelectionApi는 SelectionProvider 안에서만 쓸 수 있다.')
  return api
}
