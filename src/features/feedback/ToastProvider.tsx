import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'error' | 'warning' | 'success'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  description?: string
  action?: ToastAction
}

export interface ToastInput {
  tone: ToastTone
  title: string
  description?: string
  action?: ToastAction
  /** 자동 소멸 시간(ms). 0이면 자동으로 사라지지 않는다. */
  durationMs?: number
}

interface ToastApi {
  push: (toast: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastListContext = createContext<Toast[] | null>(null)
const ToastApiContext = createContext<ToastApi | null>(null)

const DEFAULT_DURATION_MS = 5000

/**
 * 토스트 피드백.
 *
 * 지원자 상태와 섞지 않고 별도 Provider로 뺐다. 토스트는 화면 피드백이고
 * 지원자 데이터가 아니다. 섞으면 토스트 하나 뜰 때마다 보드 전체가 리렌더된다.
 *
 * 목록과 API를 다른 Context로 나눈 이유도 같다 — `push`만 쓰는 쪽(스토어)이
 * 토스트 목록 변경에 리렌더되면 안 된다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    ({ tone, title, description, action, durationMs = DEFAULT_DURATION_MS }: ToastInput) => {
      const id = nextId.current
      nextId.current += 1

      setToasts((current) => [...current, { id, tone, title, description, action }])

      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            timers.current.delete(id)
            setToasts((current) => current.filter((toast) => toast.id !== id))
          }, durationMs),
        )
      }

      return id
    },
    [],
  )

  // 언마운트 시 남은 타이머 정리.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastApiContext.Provider value={api}>
      <ToastListContext.Provider value={toasts}>{children}</ToastListContext.Provider>
    </ToastApiContext.Provider>
  )
}

export function useToastApi(): ToastApi {
  const api = useContext(ToastApiContext)
  if (api === null) throw new Error('useToastApi는 ToastProvider 안에서만 쓸 수 있다.')
  return api
}

export function useToasts(): Toast[] {
  const toasts = useContext(ToastListContext)
  if (toasts === null) throw new Error('useToasts는 ToastProvider 안에서만 쓸 수 있다.')
  return toasts
}
