import { useEffect } from 'react'
import { useApplicantsActions } from './ApplicantsProvider'

/**
 * Ctrl+Z / Cmd+Z 로 마지막 이동 되돌리기.
 *
 * 입력 요소에 포커스가 있을 때는 가로채지 않는다 —
 * 검색창에서 Ctrl+Z는 "방금 지운 글자 되살리기"여야 하고, 그걸 뺏으면
 * 사용자가 원래 기대하는 동작을 잃는다.
 */
export function UndoHotkey() {
  const { undoLastMove } = useApplicantsActions()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'z' && event.key !== 'Z') return
      if (!event.ctrlKey && !event.metaKey) return
      if (event.shiftKey) return // Ctrl+Shift+Z(redo)는 지원하지 않는다

      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true
      if (isTyping) return

      event.preventDefault()
      undoLastMove()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [undoLastMove])

  return null
}
