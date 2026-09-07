/**
 * 도메인 타입과 단계 정의.
 * 단계 순서·라벨은 여기 한 곳에서만 관리한다. UI와 mock 서버가 같은 정의를 쓴다.
 */

export const STAGES = ['screening', 'interview', 'offer', 'hired', 'rejected'] as const

export type Stage = (typeof STAGES)[number]

/** 단계 이동 이력 한 건. `from`이 null이면 최초 지원 시점이다. */
export interface StageChange {
  at: string
  from: Stage | null
  to: Stage
}

export interface Applicant {
  id: string
  name: string
  /** 지원 직무 */
  position: string
  /** 지원일 (ISO 8601) */
  appliedAt: string
  stage: Stage
  /**
   * 낙관적 동시성 제어용. 이동이 성공할 때마다 서버에서 +1 된다.
   * 클라이언트는 이동 요청 시 자기가 알고 있는 version을 함께 보내고,
   * 서버 version과 다르면 409로 거부된다.
   */
  version: number

  // 상세 패널용 필드
  email: string
  phone: string
  experienceYears: number
  resumeSummary: string
  memo: string
  stageHistory: StageChange[]
}

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value)
}
