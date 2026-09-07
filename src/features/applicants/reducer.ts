import type { Applicant } from '../../domain/applicant'
import type { ApplicantsAction, ApplicantsState } from './types'

function normalize(applicants: Applicant[]): Pick<ApplicantsState, 'byId' | 'allIds'> {
  const byId: Record<string, Applicant> = {}
  const allIds: string[] = []
  for (const applicant of applicants) {
    byId[applicant.id] = applicant
    allIds.push(applicant.id)
  }
  return { byId, allIds }
}

function withoutPending(pending: ApplicantsState['pending'], id: string) {
  if (pending[id] === undefined) return pending
  const next = { ...pending }
  delete next[id]
  return next
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

    case 'MOVE_START': {
      // 이번 커밋은 낙관적 반영이 아니다. 서버 응답을 기다리는 표시만 남긴다.
      // (UI를 먼저 바꾸는 건 다음 커밋)
      if (state.byId[action.id] === undefined) return state
      return { ...state, pending: { ...state.pending, [action.id]: true } }
    }

    case 'MOVE_SUCCESS': {
      const { applicant } = action
      return {
        ...state,
        byId: { ...state.byId, [applicant.id]: applicant },
        pending: withoutPending(state.pending, applicant.id),
      }
    }

    case 'MOVE_FAILURE':
      return { ...state, pending: withoutPending(state.pending, action.id) }

    default:
      return state
  }
}
