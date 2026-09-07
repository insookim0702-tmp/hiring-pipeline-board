import type { ReactNode } from 'react'
import type { Stage } from '../../domain/applicant'
import { STAGE_META } from '../../domain/stages'

interface ColumnProps {
  stage: Stage
  count: number
  children?: ReactNode
}

/**
 * 단계 컬럼 하나. 목록 시맨틱(`ul`/`li`)을 쓰고 스크린리더용 라벨에
 * 단계명과 건수를 함께 넣는다.
 */
export function Column({ stage, count, children }: ColumnProps) {
  const meta = STAGE_META[stage]

  return (
    <section
      aria-label={`${meta.label} ${count}명`}
      className="flex min-w-[264px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
    >
      <div className={`h-1 shrink-0 ${meta.accentClass}`} aria-hidden="true" />

      <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-slate-800">{meta.label}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badgeClass}`}
        >
          {count}
        </span>
      </header>

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">{children}</ul>
    </section>
  )
}
