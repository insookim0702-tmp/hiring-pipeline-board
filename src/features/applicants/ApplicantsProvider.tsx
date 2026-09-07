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
import type { Stage } from '../../domain/applicant'
import { listApplicants, moveApplicantStage } from '../../mocks'
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
  /** 카드를 다른 단계로 옮긴다. */
  moveStage: (id: string, toStage: Stage) => void
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

  /**
   * 최신 state를 담은 ref.
   *
   * `moveStage`는 요청을 보낼 때 그 카드의 현재 `version`을 알아야 한다.
   * 그런데 `state`를 `useCallback` 의존성에 넣으면 상태가 바뀔 때마다 액션 객체가
   * 새로 만들어지고, 그러면 액션만 쓰는 컴포넌트까지 전부 리렌더된다
   * (= Context를 둘로 쪼갠 이유가 무의미해진다).
   * 그래서 이벤트 핸들러에서만 읽는 최신 값은 ref로 우회한다.
   */
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const moveStage = useCallback((id: string, toStage: Stage) => {
    const applicant = stateRef.current.byId[id]
    if (applicant === undefined) return
    // 같은 단계로의 이동은 서버에 보낼 필요가 없다.
    if (applicant.stage === toStage) return

    dispatch({ type: 'MOVE_START', id, toStage })

    moveApplicantStage({ id, toStage, expectedVersion: applicant.version }).then(
      (updated) => {
        dispatch({ type: 'MOVE_SUCCESS', applicant: updated })
      },
      () => {
        // 이번 커밋은 pending만 해제한다. 낙관적 반영이 없으니 되돌릴 것도 없다.
        // 사용자 피드백(토스트)과 롤백은 다음 커밋.
        dispatch({ type: 'MOVE_FAILURE', id })
      },
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actions = useMemo<ApplicantsActions>(() => ({ reload: load, moveStage }), [load, moveStage])

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  )
}

export function useApplicantsState(): ApplicantsState {
  const state = useContext(StateContext)
  if (state === null)
    throw new Error('useApplicantsState는 ApplicantsProvider 안에서만 쓸 수 있다.')
  return state
}

export function useApplicantsActions(): ApplicantsActions {
  const actions = useContext(ActionsContext)
  if (actions === null)
    throw new Error('useApplicantsActions는 ApplicantsProvider 안에서만 쓸 수 있다.')
  return actions
}
