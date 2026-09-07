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

    default:
      return state
  }
}
