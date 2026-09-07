import { useMemo } from 'react'
import { STAGE_ORDER } from '../../domain/stages'
import { useApplicantsState } from '../applicants/ApplicantsProvider'
import { Column } from './Column'
import { groupIdsByStage } from './selectors'

/**
 * 파이프라인 보드. 데스크톱에서는 5개 컬럼이 나란히, 좁아지면 가로 스크롤된다.
 *
 * 로딩/에러/빈 상태는 다음 커밋에서 붙인다.
 */
export function Board() {
  const state = useApplicantsState()
  const groups = useMemo(() => groupIdsByStage(state), [state])

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
      {STAGE_ORDER.map((stage) => (
        <Column key={stage} stage={stage} count={groups[stage].length} />
      ))}
    </div>
  )
}
