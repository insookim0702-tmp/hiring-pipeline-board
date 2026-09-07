import { memo, useRef } from 'react'
import type { Applicant } from '../../domain/applicant'
import { STAGE_META } from '../../domain/stages'
import { formatAppliedDate } from '../../lib/format'
import { useApplicantsActions } from '../applicants/ApplicantsProvider'
import { useSelectionApi } from '../selection/SelectionProvider'
import { StageMoveMenu, type StageMoveMenuHandle } from './StageMoveMenu'

interface ApplicantCardProps {
  applicant: Applicant
  isPending: boolean
  /**
   * 이 카드가 컬럼의 Tab 스톱인지. roving tabindex의 핵심.
   * 불리언으로 좁혀 받는다 — 맵을 그대로 받으면 어떤 카드가 움직여도 memo가 깨진다.
   */
  isTabStop: boolean
  onFocus: (id: string) => void
}

/**
 * 지원자 카드.
 *
 * `memo`로 감쌌다. 정규화 스토어에서 카드 한 장만 갱신되면 그 카드의 `applicant`
 * 객체만 새 참조가 되고 나머지는 참조가 유지되므로, 카드 999장은 리렌더되지 않는다.
 * (1,000건에서 이동 1건당 리렌더 1장 — 커밋 6에서 실측)
 *
 * 그래서 이동 콜백을 prop으로 받지 않고 `useApplicantsActions()`로 직접 가져온다.
 * 부모가 매 렌더마다 새 화살표 함수를 내려주면 memo가 그대로 무력화된다.
 * (`onFocus`는 부모의 `useCallback`으로 고정된 함수라 안전하다)
 */
function ApplicantCardBase({ applicant, isPending, isTabStop, onFocus }: ApplicantCardProps) {
  const meta = STAGE_META[applicant.stage]
  const { moveStage } = useApplicantsActions()
  const { open } = useSelectionApi()
  const menuRef = useRef<StageMoveMenuHandle>(null)

  const tabIndex = isTabStop ? 0 : -1

  return (
    <li data-card-id={applicant.id}>
      <div
        className={`rounded-md border bg-white transition-colors ${
          isPending ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <button
          type="button"
          // 방향키 이동이 이 요소를 찾는다.
          data-card-focus=""
          tabIndex={tabIndex}
          onFocus={() => {
            onFocus(applicant.id)
          }}
          onClick={() => {
            open(applicant.id)
          }}
          onKeyDown={(event) => {
            // 카드에 포커스가 있는 상태에서 M으로 이동 메뉴를 연다.
            if (event.key === 'm' || event.key === 'M') {
              event.preventDefault()
              menuRef.current?.open()
            }
          }}
          aria-label={`${applicant.name}, ${applicant.position}, ${meta.label}, ${formatAppliedDate(applicant.appliedAt)} 지원. 상세 보기`}
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
          {/*
            카드 버튼의 aria-label이 이미 단계를 읽어 주므로 배지는 접근성 트리에서 뺀다.
            안 빼면 스크린리더가 단계를 두 번 읽는다.
          */}
          <span
            aria-hidden="true"
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          <StageMoveMenu
            ref={menuRef}
            currentStage={applicant.stage}
            isPending={isPending}
            applicantName={applicant.name}
            tabIndex={tabIndex}
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
