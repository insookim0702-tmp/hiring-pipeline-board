import { STAGE_META, STAGE_ORDER } from '../../domain/stages'

/** 컬럼마다 보여줄 스켈레톤 카드 수. 실제 분포처럼 앞단을 조금 더 길게 둔다. */
const SKELETON_CARDS: readonly number[] = [6, 5, 4, 3, 4]

/**
 * 로딩 스켈레톤.
 *
 * 스피너 하나로 때우지 않고 최종 레이아웃과 같은 골격을 보여준다.
 * 컬럼 수를 5로 하드코딩하지 않고 `STAGE_ORDER`를 돈다 — 단계가 늘면 같이 늘어야 한다.
 *
 * `motion-reduce:animate-none`으로 prefers-reduced-motion을 존중한다.
 */
export function BoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3" aria-hidden="true">
      {STAGE_ORDER.map((stage, columnIndex) => (
        <div
          key={stage}
          className="flex min-w-[264px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        >
          <div className={`h-1 shrink-0 ${STAGE_META[stage].accentClass} opacity-40`} />
          <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
            <span className="text-sm font-semibold text-slate-300">{STAGE_META[stage].label}</span>
            <span className="h-5 w-7 animate-pulse rounded-full bg-slate-200 motion-reduce:animate-none" />
          </div>
          <div className="flex flex-col gap-2 px-2 pb-2">
            {Array.from({ length: SKELETON_CARDS[columnIndex] ?? 4 }, (_, cardIndex) => (
              <div
                key={cardIndex}
                className="animate-pulse rounded-md border border-slate-200 bg-white px-3 py-2.5 motion-reduce:animate-none"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="h-3.5 w-16 rounded bg-slate-200" />
                  <span className="h-3 w-14 rounded bg-slate-100" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="h-3 w-20 rounded bg-slate-100" />
                  <span className="h-4 w-12 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
