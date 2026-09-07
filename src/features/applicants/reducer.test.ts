import { describe, expect, it } from 'vitest'
import type { Applicant } from '../../domain/applicant'
import { applicantsReducer } from './reducer'
import { initialApplicantsState, isMovePending, type ApplicantsState } from './types'

function applicant(overrides: Partial<Applicant> = {}): Applicant {
  return {
    id: 'a1',
    name: '홍길동',
    position: '프론트엔드 개발',
    appliedAt: '2026-08-01T00:00:00.000Z',
    stage: 'screening',
    version: 1,
    email: 'a1@example.com',
    phone: '010-0000-0000',
    experienceYears: 3,
    resumeSummary: '요약',
    memo: '',
    stageHistory: [{ at: '2026-08-01T00:00:00.000Z', from: null, to: 'screening' }],
    ...overrides,
  }
}

function readyState(applicants: Applicant[]): ApplicantsState {
  return applicantsReducer(initialApplicantsState, { type: 'LOAD_SUCCESS', applicants })
}

describe('MOVE_OPTIMISTIC', () => {
  it('응답을 기다리지 않고 단계를 먼저 바꾼다', () => {
    const state = readyState([applicant()])
    const next = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'interview',
    })

    expect(next.byId['a1']?.stage).toBe('interview')
    expect(isMovePending(next, 'a1')).toBe(true)
  })

  it('스냅샷은 반영 *전* 상태다 (이 순서가 롤백의 정확성을 결정한다)', () => {
    const state = readyState([applicant({ stage: 'screening' })])
    const next = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'interview',
    })

    expect(next.pendingMoves['a1']?.snapshot.stage).toBe('screening')
    expect(next.pendingMoves['a1']?.toStage).toBe('interview')
  })

  it('다른 카드의 객체 참조는 건드리지 않는다 (memo 유지 조건)', () => {
    const state = readyState([applicant(), applicant({ id: 'a2', name: '김철수' })])
    const before = state.byId['a2']
    const next = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'interview',
    })

    expect(next.byId['a2']).toBe(before)
  })

  it('같은 단계로의 이동은 상태를 바꾸지 않는다', () => {
    const state = readyState([applicant({ stage: 'interview' })])
    const next = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'interview',
    })

    expect(next).toBe(state)
  })
})

describe('MOVE_ROLLBACK', () => {
  it('스냅샷의 단계로 되돌리고 pending을 해제한다', () => {
    const state = readyState([applicant({ stage: 'screening' })])
    const optimistic = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'rejected',
    })
    const rolledBack = applicantsReducer(optimistic, { type: 'MOVE_ROLLBACK', id: 'a1' })

    expect(rolledBack.byId['a1']?.stage).toBe('screening')
    expect(rolledBack.byId['a1']?.version).toBe(1)
    expect(isMovePending(rolledBack, 'a1')).toBe(false)
  })

  it('pending이 없는 카드에 대한 롤백은 무해하다', () => {
    const state = readyState([applicant()])
    expect(applicantsReducer(state, { type: 'MOVE_ROLLBACK', id: 'a1' })).toBe(state)
  })
})

describe('MOVE_RESYNC — 롤백과 다르다', () => {
  it('스냅샷이 아니라 서버가 준 상태로 맞춘다', () => {
    const state = readyState([applicant({ stage: 'screening', version: 1 })])
    const optimistic = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'hired',
    })

    // 서버는 그 사이 offer/version 2가 되어 있었다.
    const serverCurrent = applicant({ stage: 'offer', version: 2 })
    const resynced = applicantsReducer(optimistic, {
      type: 'MOVE_RESYNC',
      applicant: serverCurrent,
    })

    // 롤백이라면 'screening'이어야 한다. 재동기화이므로 'offer'다.
    expect(resynced.byId['a1']?.stage).toBe('offer')
    expect(resynced.byId['a1']?.version).toBe(2)
    expect(isMovePending(resynced, 'a1')).toBe(false)
  })
})

describe('MOVE_CONFIRMED', () => {
  it('서버가 준 version을 반영한다 (안 하면 다음 이동이 무조건 409)', () => {
    const state = readyState([applicant({ version: 1 })])
    const optimistic = applicantsReducer(state, {
      type: 'MOVE_OPTIMISTIC',
      id: 'a1',
      toStage: 'interview',
    })
    const confirmed = applicantsReducer(optimistic, {
      type: 'MOVE_CONFIRMED',
      applicant: applicant({ stage: 'interview', version: 2 }),
    })

    expect(confirmed.byId['a1']?.version).toBe(2)
    expect(isMovePending(confirmed, 'a1')).toBe(false)
  })
})

describe('LOAD_ERROR', () => {
  it('이미 받아둔 데이터를 지우지 않는다 (재적재 실패 시 보드 유지)', () => {
    const state = readyState([applicant()])
    const errored = applicantsReducer(state, { type: 'LOAD_ERROR', message: '실패' })

    expect(errored.status).toBe('error')
    expect(errored.allIds).toHaveLength(1)
    expect(errored.byId['a1']).toBeDefined()
  })
})
