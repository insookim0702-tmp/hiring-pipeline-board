import { memo } from 'react'
import type { Applicant } from '../../domain/applicant'
import { STAGE_META } from '../../domain/stages'
import { formatAppliedDate } from '../../lib/format'

interface ApplicantCardProps {
  applicant: Applicant
}

/**
 * 지원자 카드.
 *
 * `memo`로 감쌌다. 정규화 스토어에서 카드 한 장만 갱신되면 그 카드의 `applicant`
 * 객체만 새 참조가 되고 나머지는 참조가 유지되므로, 카드 999장은 리렌더되지 않는다.
 * 그래서 prop은 `applicant` 하나만 받는다 — 인라인 객체나 화살표 함수를 넘기면
 * 이 성질이 그대로 깨진다.
 */
function ApplicantCardBase({ applicant }: ApplicantCardProps) {
  const meta = STAGE_META[applicant.stage]

  return (
    <li className="relative">
      <button
        type="button"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{applicant.name}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
            {formatAppliedDate(applicant.appliedAt)}
          </span>
        </span>

        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-slate-600">{applicant.position}</span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
        </span>
      </button>
    </li>
  )
}

export const ApplicantCard = memo(ApplicantCardBase)
