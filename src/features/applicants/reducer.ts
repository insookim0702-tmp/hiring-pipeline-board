import type { Applicant } from '../../domain/applicant'
import { normalizeSearchText } from '../../lib/search'
import type { ApplicantsAction, ApplicantsState, PendingMove } from './types'

function normalize(
  applicants: Applicant[],
): Pick<ApplicantsState, 'byId' | 'allIds' | 'searchIndex'> {
  const byId: Record<string, Applicant> = {}
  const allIds: string[] = []
  const searchIndex: Record<string, string> = {}
  for (const applicant of applicants) {
    byId[applicant.id] = applicant
    allIds.push(applicant.id)
    // 검색 대상 문자열을 로드 시점에 한 번만 정규화한다.
    // 매 입력마다 1,000건을 toLowerCase 하면 그게 그대로 입력 지연이 된다.
    searchIndex[applicant.id] = normalizeSearchText(`${applicant.name} ${applicant.position}`)
  }
  return { byId, allIds, searchIndex }
}

function withoutPending(
  pendingMoves: Record<string, PendingMove>,
  id: string,
): Record<string, PendingMove> {
  if (pendingMoves[id] === undefined) return pendingMoves
  const next = { ...pendingMoves }
  delete next[id]
  return next
}

/** 카드 한 장만 교체한다. 나머지 카드의 객체 참조는 그대로 유지되어 memo가 살아 있다. */
function replaceApplicant(state: ApplicantsState, applicant: Applicant): ApplicantsState {
  return {
    ...state,
    byId: { ...state.byId, [applicant.id]: applicant },
    pendingMoves: withoutPending(state.pendingMoves, applicant.id),
  }
}

export function applicantsReducer(
  state: ApplicantsState,
  action: ApplicantsAction,
): ApplicantsState {
  switch (action.type) {
    case 'LOAD_START':
      // 재시도 시 이전 에러를 먼저 지운다. 안 지우면 로딩 중에도 에러 UI가 남는다.
      return { ...state, status: 'loading', error: null }

    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: 'ready',
        error: null,
        ...normalize(action.applicants),
      }

    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: action.message }

    case 'MOVE_OPTIMISTIC': {
      const current = state.byId[action.id]
      if (current === undefined) return state
      if (current.stage === action.toStage) return state

      return {
        ...state,
        // 낙관적 반영: 응답을 기다리지 않고 UI를 먼저 바꾼다.
        byId: { ...state.byId, [action.id]: { ...current, stage: action.toStage } },
        pendingMoves: {
          ...state.pendingMoves,
          [action.id]: {
            // 반영 *전* 상태에서 캡처한다. 이 순서가 롤백의 정확성을 결정한다.
            snapshot: current,
            toStage: action.toStage,
          },
        },
      }
    }

    case 'MOVE_CONFIRMED':
      return replaceApplicant(state, action.applicant)

    case 'MOVE_ROLLBACK': {
      const pending = state.pendingMoves[action.id]
      // 이미 정리된 이동이면 아무것도 하지 않는다.
      if (pending === undefined) return state
      return replaceApplicant(state, pending.snapshot)
    }

    case 'APPLICANT_FETCHED': {
      const { applicant } = action
      if (state.byId[applicant.id] === undefined) return state
      /**
       * 낙관적 이동이 진행 중이면 조회 결과를 버린다.
       *
       * 상세 조회는 이동 요청과 무관하게 날아가므로, 서버가 아직 이동을 반영하지
       * 않은 응답이 늦게 도착해 화면의 낙관적 상태를 되돌려 버릴 수 있다.
       * 이동이 확정되면 `MOVE_CONFIRMED`가 서버 객체 전체(stageHistory 포함)로
       * 교체하므로 여기서 굳이 병합하지 않아도 데이터가 최신이 된다.
       */
      if (state.pendingMoves[applicant.id] !== undefined) return state
      return { ...state, byId: { ...state.byId, [applicant.id]: applicant } }
    }

    case 'MOVE_RESYNC':
      // 롤백과 코드가 같아 보이지만 의미가 다르다. 되돌리는 게 아니라
      // 서버가 알려준 현재 상태로 맞추는 것이다.
      return replaceApplicant(state, action.applicant)

    default:
      return state
  }
}
