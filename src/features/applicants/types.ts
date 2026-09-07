import type { Applicant, Stage } from '../../domain/applicant'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * 진행 중인 낙관적 이동 한 건.
 *
 * `snapshot`은 **요청을 시작한 시점의 카드 상태**다. 실패하면 이 값으로 되돌린다.
 * 스냅샷을 낙관적 반영 *이후*에 캡처하면 롤백이 "방금 낙관적으로 바꾼 값"으로
 * 되돌아가버려 아무 의미가 없다. 그래서 캡처는 반드시 리듀서가 받은 `state`
 * (= 반영 전 상태)에서 이루어져야 한다.
 */
export interface PendingMove {
  snapshot: Applicant
  toStage: Stage
}

/**
 * 지원자 상태는 정규화해서 보관한다(`byId` + `allIds`).
 *
 * 이유: 카드 한 장만 낙관적으로 갱신해야 한다. 배열에 담아두면 매 이동마다
 * 전체를 순회·복사해야 하고, 1,000건에서 리렌더 범위를 좁히기도 어렵다.
 */
export interface ApplicantsState {
  status: LoadStatus
  byId: Record<string, Applicant>
  allIds: string[]
  /** 전체 로드 실패 사유. status === 'error'일 때만 채워진다. */
  error: string | null
  /** 낙관적으로 반영했지만 서버 확정을 못 받은 이동들. */
  pendingMoves: Record<string, PendingMove>
  /**
   * id → 정규화된 검색 문자열(이름 + 직무).
   * 로드 시점에 한 번 만들어 두고 검색에서 재사용한다.
   */
  searchIndex: Record<string, string>
}

export type ApplicantsAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; applicants: Applicant[] }
  | { type: 'LOAD_ERROR'; message: string }
  /** UI를 먼저 바꾸고 스냅샷을 남긴다. */
  | { type: 'MOVE_OPTIMISTIC'; id: string; toStage: Stage }
  /** 서버가 확정했다. 서버가 준 객체(version 포함)로 교체한다. */
  | { type: 'MOVE_CONFIRMED'; applicant: Applicant }
  /** 요청이 서버에 닿지 못했다. 스냅샷으로 되돌린다. */
  | { type: 'MOVE_ROLLBACK'; id: string }
  /**
   * 버전 충돌(409). 롤백이 아니다 —
   * 내 스냅샷도 이미 낡았으므로 서버가 알려준 현재 상태로 맞춘다.
   */
  | { type: 'MOVE_RESYNC'; applicant: Applicant }

export const initialApplicantsState: ApplicantsState = {
  status: 'idle',
  byId: {},
  allIds: [],
  error: null,
  pendingMoves: {},
  searchIndex: {},
}

export function isMovePending(state: ApplicantsState, id: string): boolean {
  return state.pendingMoves[id] !== undefined
}
