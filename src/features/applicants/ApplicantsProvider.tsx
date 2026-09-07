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
import { listApplicants, moveApplicantStage } from '../../mocks'
import { useAnnouncer } from '../feedback/AnnouncerProvider'
import { useToastApi } from '../feedback/ToastProvider'
import { createMoveQueue, type MoveQueue } from './moveQueue'
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

  /**
   * 카드별 이동 요청 큐.
   *
   * 같은 카드의 요청을 직렬화하고, 대기 중 의도는 마지막 것만 남기고,
   * 낡은 응답으로 화면을 확정하지 않는다. 상세는 `moveQueue.ts`.
   *
   * version을 스토어에서 읽지 않고 큐가 직접 들고 가는 이유:
   * 큐는 응답 직후 곧바로 다음 요청을 보내는데, 그 시점에는 React가 아직
   * 커밋하지 않아 스토어를 읽으면 낡은 version이 나온다.
   */
  /**
   * 큐 인스턴스는 ref에 담고 **effect에서 생성**한다.
   *
   * `useMemo`로 만들었더니 React Compiler 린트가 막았다:
   * "Passing a ref to a function may read its value during render".
   * `readVersion`이 `stateRef`를 캡처하니 렌더 중 ref 접근으로 판정될 수 있다는 지적이다.
   * 실제로는 요청 시점에만 읽지만, 규칙을 끄는 대신 생성 자체를 렌더 밖으로 옮겼다.
   */
  const queueRef = useRef<MoveQueue | null>(null)

  useEffect(() => {
    queueRef.current = createMoveQueue({
      readVersion: (id) => stateRef.current.byId[id]?.version,
      send: (id, toStage, expectedVersion) => moveApplicantStage({ id, toStage, expectedVersion }),

      onConfirmed: (_id, applicant) => {
        dispatch({ type: 'MOVE_CONFIRMED', applicant })
        announce(`${applicant.name} 님을 ${stageLabel(applicant.stage)} 단계로 이동했습니다.`)
      },

      onConflict: (_id, serverCurrent) => {
        // 롤백이 아니라 재동기화. 내가 들고 있던 스냅샷도 이미 낡았다.
        dispatch({ type: 'MOVE_RESYNC', applicant: serverCurrent })
        const serverLabel = stageLabel(serverCurrent.stage)
        toast.push({
          tone: 'warning',
          title: `${serverCurrent.name} 님의 단계가 이미 변경되었습니다`,
          description: `다른 변경이 먼저 반영되어 ${serverLabel}(으)로 맞췄습니다.`,
        })
        announce(
          `${serverCurrent.name} 님 이동 실패. 다른 변경이 먼저 반영되어 ${serverLabel} 단계로 맞췄습니다.`,
          'assertive',
        )
      },

      onFailed: (id, error, intendedStage) => {
        const name = stateRef.current.byId[id]?.name ?? '지원자'
        const restored = stateRef.current.pendingMoves[id]?.snapshot.stage
        dispatch({ type: 'MOVE_ROLLBACK', id })

        const toLabel = stageLabel(intendedStage)
        const fromLabel = restored === undefined ? '이전' : stageLabel(restored)
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

      onCoalesced: (id, skippedStage) => {
        /**
         * 병합으로 서버에 보내지 않은 중간 단계.
         * `stageHistory`에 남지 않으므로 조용히 넘기지 않고 남겨 둔다.
         * (사용자에게 토스트로 알리면 소음이라 개발 로그로만)
         */
        if (import.meta.env.DEV) {
          console.debug(
            `[moveQueue] ${id}: 중간 단계 ${stageLabel(skippedStage)}를 병합해 서버에 보내지 않음`,
          )
        }
      },
    })
  }, [announce, toast])

  const moveStage = useCallback((id: string, toStage: Stage) => {
    const applicant = stateRef.current.byId[id]
    if (applicant === undefined) return
    // 같은 단계로의 이동은 서버에 보낼 필요가 없다.
    if (applicant.stage === toStage) return

    // 1) UI를 먼저 바꾼다. 스냅샷 캡처는 리듀서가 반영 전 상태에서 수행하고,
    //    이미 진행 중인 이동이 있으면 기존 스냅샷을 유지한다.
    dispatch({ type: 'MOVE_OPTIMISTIC', id, toStage })
    // 2) 큐에 넣는다. 같은 카드는 순차 실행, 다른 카드는 병렬.
    queueRef.current?.enqueue(id, toStage)
  }, [])

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
