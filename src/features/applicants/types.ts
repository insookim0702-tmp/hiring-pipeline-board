import type { Applicant } from '../../domain/applicant'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * 지원자 상태는 정규화해서 보관한다(`byId` + `allIds`).
 *
 * 이유: 이후 커밋에서 카드 한 장만 낙관적으로 갱신해야 한다.
 * 배열에 담아두면 매 이동마다 전체를 순회·복사해야 하고, 1,000건에서
 * 리렌더 범위를 좁히기도 어렵다.
 */
export interface ApplicantsState {
  status: LoadStatus
  byId: Record<string, Applicant>
  allIds: string[]
  /** 전체 로드 실패 사유. status === 'error'일 때만 채워진다. */
  error: string | null
}

export type ApplicantsAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; applicants: Applicant[] }
  | { type: 'LOAD_ERROR'; message: string }

export const initialApplicantsState: ApplicantsState = {
  status: 'idle',
  byId: {},
  allIds: [],
  error: null,
}
