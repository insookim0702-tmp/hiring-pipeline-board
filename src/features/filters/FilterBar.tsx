import { useEffect, useId, useRef, useState } from 'react'
import { hasActiveFilters, useFilters, useFiltersApi } from './FiltersProvider'

interface FilterBarProps {
  positions: readonly string[]
  /** 필터 적용 후 남은 건수 / 전체 건수 */
  matchedTotal: number
  total: number
}

export function FilterBar({ positions, matchedTotal, total }: FilterBarProps) {
  const filters = useFilters()
  const { setQuery, togglePosition, clear } = useFiltersApi()
  const [isPositionOpen, setIsPositionOpen] = useState(false)
  const positionRef = useRef<HTMLDivElement>(null)
  const searchId = useId()
  const panelId = useId()

  useEffect(() => {
    if (!isPositionOpen) return
    function onPointerDown(event: MouseEvent) {
      if (positionRef.current?.contains(event.target as Node) === false) setIsPositionOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPositionOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isPositionOpen])

  const isActive = hasActiveFilters(filters)

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
      <label htmlFor={searchId} className="text-xs font-medium text-slate-600">
        이름 검색
      </label>
      <input
        id={searchId}
        type="search"
        value={filters.query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        placeholder="이름 또는 직무"
        className="w-52 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-sky-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-500"
      />

      <div ref={positionRef} className="relative">
        <button
          type="button"
          aria-expanded={isPositionOpen}
          aria-controls={isPositionOpen ? panelId : undefined}
          onClick={() => {
            setIsPositionOpen((open) => !open)
          }}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          직무
          {filters.positions.length > 0 && (
            <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
              {filters.positions.length}
            </span>
          )}
        </button>

        {isPositionOpen && (
          <div
            id={panelId}
            className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            <fieldset>
              <legend className="px-1.5 py-1 text-[11px] font-semibold text-slate-500">
                직무 선택
              </legend>
              {positions.map((position) => (
                <label
                  key={position}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <input
                    type="checkbox"
                    checked={filters.positions.includes(position)}
                    onChange={() => {
                      togglePosition(position)
                    }}
                    className="size-3.5 accent-sky-600"
                  />
                  {position}
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </div>

      {isActive && (
        <>
          <span className="text-xs text-slate-500">
            {matchedTotal.toLocaleString('ko-KR')} / {total.toLocaleString('ko-KR')}명
          </span>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            필터 초기화
          </button>
        </>
      )}
    </div>
  )
}
