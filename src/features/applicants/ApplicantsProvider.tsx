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
import type { Applicant, Stage } from '../../domain/applicant'
import { stageLabel } from '../../domain/stages'
import { ConflictError, listApplicants, moveApplicantStage } from '../../mocks'
import { useAnnouncer } from '../feedback/AnnouncerProvider'
import { useToastApi } from '../feedback/ToastProvider'
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
  /** 상세 조회 결과를 스토어에 반영한다. 패널이 자기 사본을 들지 않게 하려는 것. */
  dispatchFetched: (applicant: Applicant) => void
}

const ActionsContext = createContext<ApplicantsActions | null>(null)

export function ApplicantsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(applicantsReducer, initialApplicantsState)
  const toast = useToastApi()
  const { announce } = useAnnouncer()

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

  const moveStage = useCallback(
    (id: string, toStage: Stage) => {
      const applicant = stateRef.current.byId[id]
      if (applicant === undefined) return
      // 같은 단계로의 이동은 서버에 보낼 필요가 없다.
      if (applicant.stage === toStage) return

      const name = applicant.name
      const fromLabel = stageLabel(applicant.stage)
      const toLabel = stageLabel(toStage)

      // 1) UI를 먼저 바꾼다. 스냅샷 캡처는 리듀서가 반영 전 상태에서 수행한다.
      dispatch({ type: 'MOVE_OPTIMISTIC', id, toStage })

      // 2) 서버에 보낸다. 실패하면 되돌린다.
      moveApplicantStage({ id, toStage, expectedVersion: applicant.version }).then(
        (updated) => {
          dispatch({ type: 'MOVE_CONFIRMED', applicant: updated })
          announce(`${name} 님을 ${toLabel} 단계로 이동했습니다.`)
        },
        (error: unknown) => {
          if (error instanceof ConflictError) {
            // 버전 충돌: 롤백이 아니라 서버 상태로 재동기화한다.
            // 내가 들고 있던 스냅샷도 이미 낡았기 때문이다.
            dispatch({ type: 'MOVE_RESYNC', applicant: error.current })
            const serverLabel = stageLabel(error.current.stage)
            toast.push({
              tone: 'warning',
              title: `${name} 님의 단계가 이미 변경되었습니다`,
              description: `다른 변경이 먼저 반영되어 ${serverLabel}(으)로 맞췄습니다.`,
            })
            announce(
              `${name} 님 이동 실패. 다른 변경이 먼저 반영되어 ${serverLabel} 단계로 맞췄습니다.`,
              'assertive',
            )
            return
          }

          dispatch({ type: 'MOVE_ROLLBACK', id })
          announce(
            `${name} 님을 ${toLabel} 단계로 옮기지 못했습니다. ${fromLabel} 단계로 되돌렸습니다.`,
            'assertive',
          )
          toast.push({
            tone: 'error',
            title: `${name} 님을 ${toLabel}(으)로 옮기지 못했습니다`,
            description: `${fromLabel}(으)로 되돌렸습니다. ${
              error instanceof Error ? error.message : '알 수 없는 오류'
            }`,
          })
        },
      )
    },
    [toast, announce],
  )

  const dispatchFetched = useCallback((applicant: Applicant) => {
    dispatch({ type: 'APPLICANT_FETCHED', applicant })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actions = useMemo<ApplicantsActions>(
    () => ({ reload: load, moveStage, dispatchFetched }),
    [load, moveStage, dispatchFetched],
  )

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
