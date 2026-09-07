import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Urgency = 'polite' | 'assertive'

interface AnnouncerApi {
  announce: (message: string, urgency?: Urgency) => void
}

const AnnouncerApiContext = createContext<AnnouncerApi | null>(null)

/**
 * 스크린리더 안내의 **단일 창구**.
 *
 * 왜 토스트와 분리했나:
 * - 성공한 이동은 토스트를 띄우지 않는(또는 나중에 띄우는) 반면 안내는 해야 한다.
 * - 토스트와 live region이 각각 알리면 같은 사건이 두 번 낭독된다.
 * 그래서 안내는 전부 여기로 모으고, `ToastViewport`는 시각 표현만 담당한다.
 *
 * live region 컨테이너는 **항상 DOM에 있다.** 메시지와 함께 마운트하면
 * 스크린리더가 변경을 감지하지 못해 낭독하지 않는 경우가 많다.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  const announce = useCallback((message: string, urgency: Urgency = 'polite') => {
    const setter = urgency === 'assertive' ? setAssertive : setPolite
    // 같은 문구가 연속으로 오면 텍스트가 안 바뀌어 낭독되지 않는다.
    // 빈 문자열을 한 번 거쳐 변경을 확실히 만든다.
    setter('')
    setter(message)
  }, [])

  const api = useMemo<AnnouncerApi>(() => ({ announce }), [announce])

  return (
    <AnnouncerApiContext.Provider value={api}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerApiContext.Provider>
  )
}

export function useAnnouncer(): AnnouncerApi {
  const api = useContext(AnnouncerApiContext)
  if (api === null) throw new Error('useAnnouncer는 AnnouncerProvider 안에서만 쓸 수 있다.')
  return api
}
