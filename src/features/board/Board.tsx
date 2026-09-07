import { useMemo } from 'react'
import { STAGE_ORDER } from '../../domain/stages'
import { useApplicantsState } from '../applicants/ApplicantsProvider'
import { ApplicantCard } from './ApplicantCard'
import { Column } from './Column'
import { groupByStage } from './selectors'

/**
 * 파이프라인 보드. 데스크톱에서는 5개 컬럼이 나란히, 좁아지면 가로 스크롤된다.
 *
 * 로딩/에러/빈 상태는 다음 커밋에서 붙인다.
 */
export function Board() {
  const state = useApplicantsState()
  const groups = useMemo(() => groupByStage(state), [state])

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
      {STAGE_ORDER.map((stage) => {
        const applicants = groups[stage]
        return (
          <Column key={stage} stage={stage} count={applicants.length}>
            {applicants.map((applicant) => (
              <ApplicantCard key={applicant.id} applicant={applicant} />
            ))}
          </Column>
        )
      })}
    </div>
  )
}
