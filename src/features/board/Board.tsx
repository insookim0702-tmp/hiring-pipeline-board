import { useDeferredValue, useMemo } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { STAGE_ORDER } from '../../domain/stages'
import { useApplicantsActions, useApplicantsState } from '../applicants/ApplicantsProvider'
import { isMovePending } from '../applicants/types'
import { FilterBar } from '../filters/FilterBar'
import { hasActiveFilters, useFilters, useFiltersApi } from '../filters/FiltersProvider'
import { ApplicantCard } from './ApplicantCard'
import { BoardError, ReloadErrorBanner } from './BoardError'
import { BoardSkeleton } from './BoardSkeleton'
import { Column } from './Column'
import { selectBoardView, selectPositions } from './selectors'

/**
 * 파이프라인 보드.
 *
 * 상태 분기:
 * - 데이터 없음 + 로딩/최초  → 스켈레톤
 * - 데이터 없음 + 실패       → 전체 에러 패널 (보드 대신)
 * - 데이터 있음 + 실패       → 비차단 배너 + 기존 보드 유지
 * - 데이터 0건 (로드는 성공) → 빈 상태 ①
 * - 필터 결과 0건            → 빈 상태 ③ (초기화 버튼 포함)
 */
export function Board() {
  const state = useApplicantsState()
  const { reload } = useApplicantsActions()
  const filters = useFilters()
  const { clear } = useFiltersApi()

  /**
   * 입력 반응성과 목록 계산을 분리한다.
   *
   * 디바운스를 쓰지 않은 이유: 디바운스는 "일정 시간 아무 일도 하지 않는" 방식이라
   * 빠르게 치면 중간 결과가 아예 안 보이고, 멈추면 한 박자 늦게 튄다.
   * `useDeferredValue`는 입력은 즉시 반영하고 무거운 목록만 이전 값으로 버티다가
   * 여유가 생기면 따라잡는다. 지연 시간을 추측해 고를 필요도 없다.
   */
  const deferredFilters = useDeferredValue(filters)
  const isFiltering = deferredFilters !== filters

  const { groups, matchedTotal } = useMemo(
    () => selectBoardView(state, deferredFilters),
    [state, deferredFilters],
  )
  const positions = useMemo(() => selectPositions(state), [state])

  const hasData = state.allIds.length > 0

  if (state.status === 'error' && !hasData) {
    return <BoardError message={state.error ?? '알 수 없는 오류'} onRetry={reload} />
  }

  // 'idle' | 'loading' 이면서 아직 보여줄 데이터가 없는 상태.
  if (!hasData && state.status !== 'ready') {
    return <BoardSkeleton />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {state.status === 'error' && (
        <ReloadErrorBanner message={state.error ?? '알 수 없는 오류'} onRetry={reload} />
      )}

      {hasData && (
        <FilterBar positions={positions} matchedTotal={matchedTotal} total={state.allIds.length} />
      )}

      {!hasData ? (
        // 빈 상태 ①: 로드는 성공했지만 지원자가 한 명도 없다.
        <EmptyState
          title="등록된 지원자가 없습니다"
          description="지원자가 등록되면 단계별로 이 보드에 표시됩니다."
        />
      ) : matchedTotal === 0 && hasActiveFilters(deferredFilters) ? (
        // 빈 상태 ③: 데이터는 있지만 필터를 통과한 지원자가 없다.
        <EmptyState
          title="조건에 맞는 지원자가 없습니다"
          description="검색어나 직무 필터를 조정해 보세요."
          action={
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              필터 초기화
            </button>
          }
        />
      ) : (
        <div
          // 목록이 아직 따라잡지 못한 동안 살짝 흐리게 해서 계산 중임을 알린다.
          className={`flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 transition-opacity ${
            isFiltering ? 'opacity-60' : ''
          }`}
        >
          {STAGE_ORDER.map((stage) => {
            const applicants = groups[stage]
            return (
              <Column key={stage} stage={stage} count={applicants.length}>
                {applicants.map((applicant) => (
                  <ApplicantCard
                    key={applicant.id}
                    applicant={applicant}
                    // 불리언으로 좁혀서 넘긴다. pendingMoves 객체를 그대로 넘기면
                    // 다른 카드가 이동할 때마다 모든 카드의 prop이 바뀌어 memo가 깨진다.
                    isPending={isMovePending(state, applicant.id)}
                  />
                ))}
              </Column>
            )
          })}
        </div>
      )}
    </div>
  )
}
