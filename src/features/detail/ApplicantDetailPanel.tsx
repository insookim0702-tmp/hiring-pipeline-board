import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { STAGE_META, stageLabel } from '../../domain/stages'
import { formatAppliedDate, formatDateTime } from '../../lib/format'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { getApplicant } from '../../mocks'
import { useApplicantsActions, useApplicantsState } from '../applicants/ApplicantsProvider'
import { isMovePending } from '../applicants/types'
import { StageMoveMenu } from '../board/StageMoveMenu'
import { useSelectionApi } from '../selection/SelectionProvider'

type FetchStatus = 'loading' | 'ready' | 'error'

interface ApplicantDetailPanelProps {
  applicantId: string
}

/**
 * 지원자 상세 — 모달이 아니라 오른쪽 사이드 패널.
 *
 * 보드를 가리지 않아 "이 사람이 지금 어느 단계에 있고 옆 단계에 누가 있는지"를
 * 함께 볼 수 있다. 다만 `aria-modal="true"`를 선언하는 이상 키보드 초점은
 * 패널 안에 머물러야 하므로, 배경 보드는 `inert`로 상호작용에서 제외한다.
 * (숨기지는 않는다 — 문맥 유지가 패널을 택한 이유이므로)
 *
 * 상세 데이터는 스토어로 흘려보내고 패널은 스토어만 읽는다.
 * 패널이 자기 사본을 들고 있으면 낙관적 이동이 일어났을 때 보드와 값이 어긋난다.
 */
export function ApplicantDetailPanel({ applicantId }: ApplicantDetailPanelProps) {
  const state = useApplicantsState()
  const { moveStage, dispatchFetched } = useApplicantsActions()
  const { close } = useSelectionApi()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // 초기값이 곧 마운트 직후의 상태다. effect에서 동기적으로 setState 하지 않는다
  // (ESLint react-hooks/set-state-in-effect. 불필요한 렌더도 한 번 줄어든다).
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading')
  const [fetchError, setFetchError] = useState<string | null>(null)

  // 상세 조회도 15% 확률로 실패한다. 낡은 응답이 반영되지 않게 순번으로 막는다.
  const fetchSeq = useRef(0)

  /** 요청만 보낸다. 상태 전이는 응답이 왔을 때(=effect 밖)에서만 일어난다. */
  const runFetch = useCallback(() => {
    const seq = fetchSeq.current + 1
    fetchSeq.current = seq

    getApplicant(applicantId).then(
      (applicant) => {
        if (fetchSeq.current !== seq) return
        dispatchFetched(applicant)
        setFetchStatus('ready')
      },
      (error: unknown) => {
        if (fetchSeq.current !== seq) return
        setFetchError(error instanceof Error ? error.message : '알 수 없는 오류')
        setFetchStatus('error')
      },
    )
  }, [applicantId, dispatchFetched])

  /** 재시도 버튼용. 이건 이벤트 핸들러라 setState가 문제되지 않는다. */
  const retryFetch = useCallback(() => {
    setFetchStatus('loading')
    setFetchError(null)
    runFetch()
  }, [runFetch])

  useEffect(() => {
    runFetch()
  }, [runFetch])

  useFocusTrap(panelRef, true)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close])

  const applicant = state.byId[applicantId]
  const pending = isMovePending(state, applicantId)

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="flex w-[min(24rem,100vw)] shrink-0 flex-col border-l border-slate-200 bg-white shadow-[-4px_0_16px_rgba(15,23,42,0.06)]"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-sm font-semibold text-slate-900">
            {applicant?.name ?? '지원자 상세'}
          </h2>
          {applicant !== undefined && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{applicant.position}</p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          닫기
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {applicant === undefined ? (
          <p className="text-xs text-slate-500">지원자를 찾을 수 없습니다.</p>
        ) : (
          <>
            <section className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-[11px] font-medium text-slate-500">현재 단계</p>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STAGE_META[applicant.stage].badgeClass}`}
                  >
                    {stageLabel(applicant.stage)}
                  </span>
                  {pending && <span className="text-[11px] text-sky-700">이동 중…</span>}
                </p>
              </div>
              <StageMoveMenu
                currentStage={applicant.stage}
                isPending={pending}
                applicantName={applicant.name}
                onSelect={(stage) => {
                  moveStage(applicant.id, stage)
                }}
              />
            </section>

            {fetchStatus === 'loading' && (
              <p className="mt-3 text-xs text-slate-500">상세 정보를 불러오는 중…</p>
            )}

            {fetchStatus === 'error' && (
              <div
                role="alert"
                className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5"
              >
                <p className="text-xs font-medium text-rose-900">상세 정보를 불러오지 못했습니다</p>
                <p className="mt-0.5 text-xs text-rose-800">{fetchError}</p>
                <button
                  type="button"
                  onClick={retryFetch}
                  className="mt-2 rounded border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-900 transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                >
                  다시 시도
                </button>
              </div>
            )}

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-slate-500">지원일</dt>
              <dd className="tabular-nums text-slate-800">
                {formatAppliedDate(applicant.appliedAt)}
              </dd>
              <dt className="text-slate-500">경력</dt>
              <dd className="text-slate-800">{applicant.experienceYears}년</dd>
              <dt className="text-slate-500">이메일</dt>
              <dd className="break-all text-slate-800">{applicant.email}</dd>
              <dt className="text-slate-500">연락처</dt>
              <dd className="tabular-nums text-slate-800">{applicant.phone}</dd>
            </dl>

            <section className="mt-4">
              <h3 className="text-[11px] font-semibold text-slate-500">이력 요약</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-800">
                {applicant.resumeSummary}
              </p>
            </section>

            <section className="mt-4">
              <h3 className="text-[11px] font-semibold text-slate-500">메모</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-800">
                {applicant.memo === '' ? (
                  <span className="text-slate-400">작성된 메모 없음</span>
                ) : (
                  applicant.memo
                )}
              </p>
            </section>

            <section className="mt-4">
              <h3 className="text-[11px] font-semibold text-slate-500">단계 이동 이력</h3>
              <ol className="mt-1.5 space-y-1.5">
                {applicant.stageHistory.map((change, index) => (
                  <li key={`${change.at}-${index}`} className="flex items-baseline gap-2 text-xs">
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {formatDateTime(change.at)}
                    </span>
                    <span className="text-slate-800">
                      {change.from === null
                        ? `지원 (${stageLabel(change.to)})`
                        : `${stageLabel(change.from)} → ${stageLabel(change.to)}`}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
