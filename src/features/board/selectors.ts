import type { Applicant, Stage } from '../../domain/applicant'
import { STAGE_ORDER } from '../../domain/stages'
import { normalizeSearchText } from '../../lib/search'
import type { ApplicantsState } from '../applicants/types'
import type { Filters } from '../filters/FiltersProvider'

export type StageGroups = Record<Stage, Applicant[]>

export interface BoardView {
  groups: StageGroups
  /** 필터를 통과한 총 건수. 0이면 "조건에 맞는 지원자 없음" 상태다. */
  matchedTotal: number
}

function emptyGroups(): StageGroups {
  return Object.fromEntries(STAGE_ORDER.map((stage) => [stage, [] as Applicant[]])) as StageGroups
}

/**
 * 단계별로 지원자를 갈라 담으면서 필터를 함께 적용한다.
 *
 * 순회는 전체 1회다. 컬럼마다 `filter`를 돌리면 컬럼 수(5) × 전체 건수가 된다.
 * 검색어 정규화는 여기서 **질의어 쪽만** 한다 — 지원자 쪽 문자열은
 * 로드 시점에 만들어 둔 `state.searchIndex`를 재사용한다.
 */
export function selectBoardView(state: ApplicantsState, filters: Filters): BoardView {
  const groups = emptyGroups()
  const query = normalizeSearchText(filters.query)
  // 배열 `includes`는 O(n). 직무가 여러 개 선택되면 건수 × 직무 수가 되므로 Set으로.
  const positions = filters.positions.length > 0 ? new Set(filters.positions) : null
  let matchedTotal = 0

  for (const id of state.allIds) {
    const applicant = state.byId[id]
    if (applicant === undefined) continue

    if (positions !== null && !positions.has(applicant.position)) continue
    if (query !== '' && state.searchIndex[id]?.includes(query) !== true) continue

    groups[applicant.stage].push(applicant)
    matchedTotal += 1
  }

  return { groups, matchedTotal }
}

/** 필터 UI가 쓸 직무 목록. 실제 데이터에 존재하는 값만 노출한다. */
export function selectPositions(state: ApplicantsState): string[] {
  const seen = new Set<string>()
  for (const id of state.allIds) {
    const position = state.byId[id]?.position
    if (position !== undefined) seen.add(position)
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'ko'))
}

export function selectApplicant(state: ApplicantsState, id: string): Applicant | undefined {
  return state.byId[id]
}
