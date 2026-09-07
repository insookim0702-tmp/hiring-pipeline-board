import { useMemo } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { STAGE_ORDER } from '../../domain/stages'
import { useApplicantsActions, useApplicantsState } from '../applicants/ApplicantsProvider'
import { ApplicantCard } from './ApplicantCard'
import { BoardError, ReloadErrorBanner } from './BoardError'
import { BoardSkeleton } from './BoardSkeleton'
import { Column } from './Column'
import { isMovePending } from '../applicants/types'
import { groupByStage } from './selectors'

/**
 * 파이프라인 보드.
 *
 * 상태 분기:
 * - 데이터 없음 + 로딩/최초  → 스켈레톤
 * - 데이터 없음 + 실패       → 전체 에러 패널 (보드 대신)
 * - 데이터 있음 + 실패       → 비차단 배너 + 기존 보드 유지
 * - 데이터 0건 (로드는 성공) → 빈 상태 ①
 */
export function Board() {
  const state = useApplicantsState()
  const { reload } = useApplicantsActions()
  const groups = useMemo(() => groupByStage(state), [state])

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

      {hasData ? (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
          {STAGE_ORDER.map((stage) => {
            const applicants = groups[stage]
            return (
              <Column key={stage} stage={stage} count={applicants.length}>
                {applicants.map((applicant) => (
                  <ApplicantCard
                    key={applicant.id}
                    applicant={applicant}
                    // 불리언으로 좁혀서 넘긴다. pending 객체를 그대로 넘기면
                    // 다른 카드가 이동할 때마다 모든 카드의 prop이 바뀌어 memo가 깨진다.
                    isPending={isMovePending(state, applicant.id)}
                  />
                ))}
              </Column>
            )
          })}
        </div>
      ) : (
        // 빈 상태 ①: 로드는 성공했지만 지원자가 한 명도 없다.
        <EmptyState
          title="등록된 지원자가 없습니다"
          description="지원자가 등록되면 단계별로 이 보드에 표시됩니다."
        />
      )}
    </div>
  )
}
