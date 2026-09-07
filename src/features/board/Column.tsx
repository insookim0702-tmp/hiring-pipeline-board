import { useEffect, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Applicant, Stage } from '../../domain/applicant'
import { STAGE_META } from '../../domain/stages'
import { EmptyState } from '../../components/EmptyState'

/** 카드 1장 + 아래 간격의 대략적인 높이. 첫 렌더에서만 쓰이고 이후 실측으로 대체된다. */
const ESTIMATED_CARD_HEIGHT = 84

export interface ColumnScroller {
  scrollToIndex: (index: number) => void
}

interface ColumnProps {
  stage: Stage
  applicants: Applicant[]
  renderCard: (applicant: Applicant) => ReactNode
  /**
   * 컬럼의 스크롤 제어권을 부모에게 넘긴다.
   * 방향키로 화면 밖 카드에 포커스를 주려면 먼저 스크롤해서 렌더시켜야 하기 때문이다.
   */
  registerScroller: (stage: Stage, scroller: ColumnScroller | null) => void
}

/**
 * 단계 컬럼 하나. 목록 시맨틱(`ul`/`li`)을 쓰고 스크린리더용 라벨에
 * 단계명과 건수를 함께 넣는다.
 *
 * 카드는 가상 스크롤로 렌더한다. 1,000건이면 컬럼 하나에 450장까지 들어가는데,
 * 그걸 전부 DOM에 올릴 이유가 없다.
 * 높이는 고정하지 않고 실측한다 — 이름·직무 길이에 따라 카드 높이가 달라진다.
 */
export function Column({ stage, applicants, renderCard, registerScroller }: ColumnProps) {
  const meta = STAGE_META[stage]
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = applicants.length

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    // 화면 밖 카드를 조금 더 그려두면 스크롤·포커스 이동이 덜 튄다.
    overscan: 6,
  })

  useEffect(() => {
    registerScroller(stage, {
      scrollToIndex: (index) => {
        virtualizer.scrollToIndex(index, { align: 'auto' })
      },
    })
    return () => {
      registerScroller(stage, null)
    }
  }, [stage, virtualizer, registerScroller])

  const items = virtualizer.getVirtualItems()

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

      {count === 0 ? (
        // 빈 상태 ②: 데이터는 있지만 이 단계에 아무도 없다.
        <div className="min-h-0 flex-1">
          <EmptyState title="해당 단계 지원자 없음" size="sm" />
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((item) => {
              const applicant = applicants[item.index]
              if (applicant === undefined) return null
              return (
                <li
                  key={applicant.id}
                  // 방향키 이동이 이 속성으로 카드를 찾는다.
                  data-card-id={applicant.id}
                  data-index={item.index}
                  // 실제 높이를 재서 가상화에 알려준다(고정 높이 가정을 쓰지 않는다).
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full pb-2"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {renderCard(applicant)}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
