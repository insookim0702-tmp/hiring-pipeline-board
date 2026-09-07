import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { listApplicants } from '../../mocks'
import { applicantsReducer } from './reducer'
import { initialApplicantsState, type ApplicantsState } from './types'

/**
 * state와 액션을 **별도 Context로 분리**한다.
 *
 * 하나로 묶으면 state가 바뀔 때마다 "액션만 쓰는" 컴포넌트(버튼 등)까지
 * 전부 리렌더된다. 1,000건 보드에서는 이 차이가 크다.
 */
const StateContext = createContext<ApplicantsState | null>(null)

interface ApplicantsActions {
  /** 전체 목록을 다시 불러온다. 에러 화면의 "다시 시도"가 이걸 쓴다. */
  reload: () => void
}

const ActionsContext = createContext<ApplicantsActions | null>(null)

export function ApplicantsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applicantsReducer, initialApplicantsState)

  /**
   * 진행 중인 로드의 순번. 응답이 도착했을 때 이 값과 다르면 낡은 응답이므로 버린다.
   *
   * 이게 없으면 로드가 겹칠 때 늦게 온 응답이 최신 상태를 덮어쓴다.
   * 실제로 StrictMode가 effect를 두 번 실행해 로드가 2회 나가는데, 두 번째가
   * 15% 확률로 실패하면 "데이터는 있는데 status만 error"인 상태가 만들어졌다.
   */
  const loadSeq = useRef(0)

  const load = useCallback(() => {
    const seq = loadSeq.current + 1
    loadSeq.current = seq

    dispatch({ type: 'LOAD_START' })
    listApplicants().then(
      (applicants) => {
        if (loadSeq.current !== seq) return
        dispatch({ type: 'LOAD_SUCCESS', applicants })
      },
      (error: unknown) => {
        if (loadSeq.current !== seq) return
        dispatch({
          type: 'LOAD_ERROR',
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        })
      },
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actions = useMemo<ApplicantsActions>(() => ({ reload: load }), [load])

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  )
}

export function useApplicantsState(): ApplicantsState {
  const state = useContext(StateContext)
  if (state === null) throw new Error('useApplicantsState는 ApplicantsProvider 안에서만 쓸 수 있다.')
  return state
}

export function useApplicantsActions(): ApplicantsActions {
  const actions = useContext(ActionsContext)
  if (actions === null)
    throw new Error('useApplicantsActions는 ApplicantsProvider 안에서만 쓸 수 있다.')
  return actions
}
