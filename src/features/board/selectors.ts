import type { Applicant, Stage } from '../../domain/applicant'
import { STAGE_ORDER } from '../../domain/stages'
import type { ApplicantsState } from '../applicants/types'

/**
 * 단계별로 지원자 id를 한 번의 순회로 갈라 담는다.
 *
 * 컬럼마다 `allIds.filter(...)`를 돌리면 컬럼 수(5) × 전체 건수만큼 순회한다.
 * 여기서는 전체를 한 번만 훑는다.
 */
export function groupIdsByStage(state: ApplicantsState): Record<Stage, string[]> {
  const groups = Object.fromEntries(STAGE_ORDER.map((stage) => [stage, [] as string[]])) as Record<
    Stage,
    string[]
  >

  for (const id of state.allIds) {
    const applicant = state.byId[id]
    if (applicant === undefined) continue
    groups[applicant.stage].push(id)
  }

  return groups
}

export function selectApplicant(state: ApplicantsState, id: string): Applicant | undefined {
  return state.byId[id]
}
