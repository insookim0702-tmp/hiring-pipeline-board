import { memo } from 'react'
import type { Applicant } from '../../domain/applicant'
import { STAGE_META } from '../../domain/stages'
import { formatAppliedDate } from '../../lib/format'
import { useApplicantsActions } from '../applicants/ApplicantsProvider'
import { StageMoveMenu } from './StageMoveMenu'

interface ApplicantCardProps {
  applicant: Applicant
  isPending: boolean
}

/**
 * 지원자 카드.
 *
 * `memo`로 감쌌다. 정규화 스토어에서 카드 한 장만 갱신되면 그 카드의 `applicant`
 * 객체만 새 참조가 되고 나머지는 참조가 유지되므로, 카드 999장은 리렌더되지 않는다.
 *
 * 그래서 이동 콜백을 prop으로 받지 않고 `useApplicantsActions()`로 직접 가져온다.
 * 부모가 매 렌더마다 새 화살표 함수를 내려주면 memo가 그대로 무력화된다.
 * 액션 Context는 값이 고정(useMemo)이라 이 구독은 리렌더를 유발하지 않는다.
 */
function ApplicantCardBase({ applicant, isPending }: ApplicantCardProps) {
  const meta = STAGE_META[applicant.stage]
  const { moveStage } = useApplicantsActions()

  return (
    <li>
      <div
        className={`rounded-md border bg-white transition-colors ${
          isPending ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <button
          type="button"
          className="w-full rounded-t-md px-3 pt-2.5 pb-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{applicant.name}</span>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {formatAppliedDate(applicant.appliedAt)}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-600">{applicant.position}</span>
        </button>

        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          <StageMoveMenu
            currentStage={applicant.stage}
            isPending={isPending}
            applicantName={applicant.name}
            onSelect={(stage) => {
              moveStage(applicant.id, stage)
            }}
          />
        </div>
      </div>
    </li>
  )
}

export const ApplicantCard = memo(ApplicantCardBase)
