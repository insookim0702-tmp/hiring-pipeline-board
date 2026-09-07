import { describe, expect, it } from 'vitest'
import { applicantsReducer } from '../applicants/reducer'
import { initialApplicantsState } from '../applicants/types'
import { emptyFilters } from '../filters/FiltersProvider'
import { makeApplicant } from '../../test/harness'
import { selectBoardView, selectPositions } from './selectors'

const state = applicantsReducer(initialApplicantsState, {
  type: 'LOAD_SUCCESS',
  applicants: [
    makeApplicant({ id: 'a1', name: '홍길동', position: '프론트엔드 개발', stage: 'screening' }),
    makeApplicant({ id: 'a2', name: '김철수', position: '백엔드 개발', stage: 'interview' }),
    makeApplicant({ id: 'a3', name: '이영희', position: '프론트엔드 개발', stage: 'interview' }),
    makeApplicant({ id: 'a4', name: 'Kim Alex', position: 'DevOps', stage: 'hired' }),
  ],
})

describe('단계별 분류', () => {
  it('필터가 없으면 전원을 단계별로 나눈다', () => {
    const { groups, matchedTotal } = selectBoardView(state, emptyFilters)

    expect(matchedTotal).toBe(4)
    expect(groups.screening.map((a) => a.id)).toEqual(['a1'])
    expect(groups.interview.map((a) => a.id)).toEqual(['a2', 'a3'])
    expect(groups.hired.map((a) => a.id)).toEqual(['a4'])
    expect(groups.offer).toEqual([])
  })
})

describe('이름 검색', () => {
  it('부분일치로 찾는다', () => {
    const { matchedTotal, groups } = selectBoardView(state, { ...emptyFilters, query: '영희' })
    expect(matchedTotal).toBe(1)
    expect(groups.interview.map((a) => a.name)).toEqual(['이영희'])
  })

  it('대소문자를 무시한다', () => {
    expect(selectBoardView(state, { ...emptyFilters, query: 'kim' }).matchedTotal).toBe(1)
    expect(selectBoardView(state, { ...emptyFilters, query: 'KIM' }).matchedTotal).toBe(1)
  })

  it('공백을 무시한다 (질의어 쪽과 인덱스 쪽 정규화 규칙이 같아야 한다)', () => {
    expect(selectBoardView(state, { ...emptyFilters, query: 'kim alex' }).matchedTotal).toBe(1)
    expect(selectBoardView(state, { ...emptyFilters, query: 'kimalex' }).matchedTotal).toBe(1)
    expect(selectBoardView(state, { ...emptyFilters, query: ' k i m ' }).matchedTotal).toBe(1)
  })

  it('직무명으로도 찾는다', () => {
    expect(selectBoardView(state, { ...emptyFilters, query: '프론트엔드' }).matchedTotal).toBe(2)
  })

  it('일치하는 게 없으면 0건이다', () => {
    expect(selectBoardView(state, { ...emptyFilters, query: '없는이름' }).matchedTotal).toBe(0)
  })
})

describe('직무 필터', () => {
  it('선택한 직무만 남긴다', () => {
    const { matchedTotal, groups } = selectBoardView(state, {
      ...emptyFilters,
      positions: ['프론트엔드 개발'],
    })
    expect(matchedTotal).toBe(2)
    expect(groups.screening.map((a) => a.id)).toEqual(['a1'])
    expect(groups.interview.map((a) => a.id)).toEqual(['a3'])
  })

  it('여러 직무를 선택하면 합집합이다', () => {
    expect(
      selectBoardView(state, { ...emptyFilters, positions: ['DevOps', '백엔드 개발'] })
        .matchedTotal,
    ).toBe(2)
  })

  it('검색어와 직무 필터는 AND로 걸린다', () => {
    expect(
      selectBoardView(state, { query: '홍', positions: ['프론트엔드 개발'] }).matchedTotal,
    ).toBe(1)
    expect(selectBoardView(state, { query: '홍', positions: ['백엔드 개발'] }).matchedTotal).toBe(0)
  })
})

describe('selectPositions', () => {
  /**
   * 순서를 단정하지 않는다.
   *
   * 처음엔 `['DevOps', '백엔드 개발', '프론트엔드 개발']`로 단정했는데 실패했다 —
   * Node의 ko 로케일 정렬은 한글을 라틴 문자보다 앞에 놓는다.
   * `Intl` 정렬 순서는 런타임의 ICU 데이터에 따라 달라질 수 있으므로
   * (Node ↔ 브라우저가 다를 수 있다) 순서에 의존하는 단정은 깨지기 쉽다.
   * 검증해야 하는 성질은 "중복 없음"과 "실행마다 동일함"이다.
   */
  it('실제 데이터에 존재하는 직무만 중복 없이 준다', () => {
    const positions = selectPositions(state)
    expect(positions).toHaveLength(3)
    expect([...positions].sort()).toEqual([...['DevOps', '백엔드 개발', '프론트엔드 개발']].sort())
  })

  it('같은 상태에 대해 항상 같은 순서를 준다', () => {
    expect(selectPositions(state)).toEqual(selectPositions(state))
  })
})
