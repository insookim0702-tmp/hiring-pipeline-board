import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * `aria-modal="true"`를 선언했다면 Tab이 그 안을 벗어나서는 안 된다.
 * 선언만 하고 트랩이 없으면 스크린리더 사용자에게 거짓말을 하는 셈이다.
 *
 * 열릴 때 첫 포커스 대상으로 이동하고, Tab/Shift+Tab을 순환시킨다.
 * (닫을 때 원래 위치로 되돌리는 건 `SelectionProvider`가 담당한다)
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return
    const root = ref.current
    if (root === null) return

    const first = focusableIn(root)[0]
    if (first !== undefined) first.focus()
    else root.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const current = ref.current
      if (current === null) return

      const items = focusableIn(current)
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      const active = document.activeElement

      if (event.shiftKey && (active === firstItem || !current.contains(active))) {
        event.preventDefault()
        lastItem.focus()
        return
      }
      if (!event.shiftKey && (active === lastItem || !current.contains(active))) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [ref, isActive])
}
