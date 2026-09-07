import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface Filters {
  /** 이름·직무 부분일치 검색어 (원문. 정규화는 셀렉터가 한다) */
  query: string
  /** 선택된 직무. 비어 있으면 전체. */
  positions: readonly string[]
}

export const emptyFilters: Filters = { query: '', positions: [] }

export function hasActiveFilters(filters: Filters): boolean {
  return filters.query.trim() !== '' || filters.positions.length > 0
}

interface FiltersApi {
  setQuery: (query: string) => void
  togglePosition: (position: string) => void
  clear: () => void
}

const FiltersContext = createContext<Filters | null>(null)
const FiltersApiContext = createContext<FiltersApi | null>(null)

/**
 * 필터 상태를 지원자 스토어와 분리했다.
 *
 * 섞으면 타이핑 한 글자마다 지원자 스토어가 바뀌고, 그 스토어를 구독하는
 * 모든 곳이 리렌더된다. 필터는 화면 조건이지 서버 데이터가 아니다.
 */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters)

  const setQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }))
  }, [])

  const togglePosition = useCallback((position: string) => {
    setFilters((current) => ({
      ...current,
      positions: current.positions.includes(position)
        ? current.positions.filter((item) => item !== position)
        : [...current.positions, position],
    }))
  }, [])

  const clear = useCallback(() => {
    setFilters(emptyFilters)
  }, [])

  const api = useMemo<FiltersApi>(
    () => ({ setQuery, togglePosition, clear }),
    [setQuery, togglePosition, clear],
  )

  return (
    <FiltersApiContext.Provider value={api}>
      <FiltersContext.Provider value={filters}>{children}</FiltersContext.Provider>
    </FiltersApiContext.Provider>
  )
}

export function useFilters(): Filters {
  const filters = useContext(FiltersContext)
  if (filters === null) throw new Error('useFilters는 FiltersProvider 안에서만 쓸 수 있다.')
  return filters
}

export function useFiltersApi(): FiltersApi {
  const api = useContext(FiltersApiContext)
  if (api === null) throw new Error('useFiltersApi는 FiltersProvider 안에서만 쓸 수 있다.')
  return api
}
