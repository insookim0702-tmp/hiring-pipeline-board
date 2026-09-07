import { beforeEach, describe, expect, it } from 'vitest'
import { nextLatencyMs, configureMock, resetMockConfig, shouldFail } from './config'
import { generateApplicants } from './seed'
import { getApplicant, listApplicants, moveApplicantStage } from './api'
import { ConflictError, NetworkError, NotFoundError } from './errors'
import { resetStore } from './store'

const DATA_KEY = 'hpb.applicants.v1'

beforeEach(() => {
  resetMockConfig()
  // 지연 0으로 두면 테스트가 빠르고, 실패 여부는 failureRate로만 통제된다.
  configureMock({ minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0, count: 20 })
  resetStore()
})

describe('시드 생성', () => {
  it('같은 seed/count면 항상 같은 결과가 나온다', () => {
    const a = generateApplicants(42, 50)
    const b = generateApplicants(42, 50)
    expect(a).toEqual(b)
  })

  it('seed가 다르면 결과가 달라진다', () => {
    const a = generateApplicants(42, 50)
    const b = generateApplicants(43, 50)
    expect(a).not.toEqual(b)
  })

  it('모든 지원자가 version 1과 최초 이력 한 건으로 시작한다', () => {
    for (const applicant of generateApplicants(7, 30)) {
      expect(applicant.version).toBe(1)
      expect(applicant.stageHistory).toHaveLength(1)
      expect(applicant.stageHistory[0]?.from).toBeNull()
      expect(applicant.stageHistory[0]?.to).toBe(applicant.stage)
    }
  })
})

describe('지연 시뮬레이션', () => {
  it('기본 설정에서 항상 200~800ms 범위다', () => {
    resetMockConfig()
    for (let i = 0; i < 2000; i += 1) {
      const ms = nextLatencyMs()
      expect(ms).toBeGreaterThanOrEqual(200)
      expect(ms).toBeLessThanOrEqual(800)
    }
  })

  it('난수가 0이어도 하한(200ms)을 지킨다', () => {
    resetMockConfig()
    configureMock({ random: () => 0 })
    expect(nextLatencyMs()).toBe(200)
  })

  it('난수가 1에 가까워도 상한(800ms)을 넘지 않는다', () => {
    resetMockConfig()
    configureMock({ random: () => 0.9999999 })
    expect(nextLatencyMs()).toBeLessThanOrEqual(800)
  })
})

describe('실패 시뮬레이션', () => {
  it('failureRate 1이면 항상 실패한다', () => {
    configureMock({ failureRate: 1 })
    for (let i = 0; i < 100; i += 1) expect(shouldFail()).toBe(true)
  })

  it('failureRate 0이면 절대 실패하지 않는다', () => {
    configureMock({ failureRate: 0 })
    for (let i = 0; i < 100; i += 1) expect(shouldFail()).toBe(false)
  })

  it('failureRate 1이면 listApplicants가 NetworkError를 던진다', async () => {
    configureMock({ failureRate: 1 })
    await expect(listApplicants()).rejects.toBeInstanceOf(NetworkError)
  })

  it('기본 실패율은 15%다', () => {
    resetMockConfig()
    let failures = 0
    const runs = 20000
    for (let i = 0; i < runs; i += 1) if (shouldFail()) failures += 1
    // 20,000회 표본이면 0.15 ± 0.01 안에 들어온다.
    expect(failures / runs).toBeGreaterThan(0.14)
    expect(failures / runs).toBeLessThan(0.16)
  })
})

describe('moveApplicantStage', () => {
  it('성공 시 version이 +1 되고 이력이 한 건 늘어난다', async () => {
    const [first] = await listApplicants()
    expect(first).toBeDefined()
    const target = first!.stage === 'interview' ? 'offer' : 'interview'

    const moved = await moveApplicantStage({
      id: first!.id,
      toStage: target,
      expectedVersion: first!.version,
    })

    expect(moved.stage).toBe(target)
    expect(moved.version).toBe(first!.version + 1)
    expect(moved.stageHistory).toHaveLength(first!.stageHistory.length + 1)
    expect(moved.stageHistory.at(-1)).toMatchObject({ from: first!.stage, to: target })
  })

  it('이동 결과가 localStorage에 영속된다', async () => {
    const [first] = await listApplicants()
    const target = first!.stage === 'hired' ? 'rejected' : 'hired'
    await moveApplicantStage({
      id: first!.id,
      toStage: target,
      expectedVersion: first!.version,
    })

    const raw = window.localStorage.getItem(DATA_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as Array<{ id: string; stage: string }>
    expect(persisted.find((a) => a.id === first!.id)?.stage).toBe(target)
  })

  it('expectedVersion이 어긋나면 ConflictError와 함께 서버 현재 상태를 준다', async () => {
    const [first] = await listApplicants()
    const target = first!.stage === 'interview' ? 'offer' : 'interview'

    // 1회 성공시켜 서버 version을 올린다.
    const moved = await moveApplicantStage({
      id: first!.id,
      toStage: target,
      expectedVersion: first!.version,
    })

    // 낡은 version으로 다시 시도.
    const attempt = moveApplicantStage({
      id: first!.id,
      toStage: 'rejected',
      expectedVersion: first!.version,
    })

    await expect(attempt).rejects.toBeInstanceOf(ConflictError)
    await attempt.catch((error: unknown) => {
      expect(error).toBeInstanceOf(ConflictError)
      const conflict = error as ConflictError
      expect(conflict.status).toBe(409)
      expect(conflict.current.version).toBe(moved.version)
      expect(conflict.current.stage).toBe(target)
    })
  })

  it('같은 단계로 이동하면 version을 올리지 않는다', async () => {
    const [first] = await listApplicants()
    const same = await moveApplicantStage({
      id: first!.id,
      toStage: first!.stage,
      expectedVersion: first!.version,
    })
    expect(same.version).toBe(first!.version)
    expect(same.stageHistory).toHaveLength(first!.stageHistory.length)
  })

  it('없는 id면 NotFoundError', async () => {
    await expect(
      moveApplicantStage({ id: 'apl-99999', toStage: 'hired', expectedVersion: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('실패한 요청은 서버 상태를 바꾸지 않는다', async () => {
    const [first] = await listApplicants()
    configureMock({ failureRate: 1 })
    await expect(
      moveApplicantStage({ id: first!.id, toStage: 'rejected', expectedVersion: first!.version }),
    ).rejects.toBeInstanceOf(NetworkError)

    configureMock({ failureRate: 0 })
    const after = await getApplicant(first!.id)
    expect(after.stage).toBe(first!.stage)
    expect(after.version).toBe(first!.version)
  })
})

describe('저장소 격리', () => {
  it('밖으로 나간 객체를 변형해도 저장소가 오염되지 않는다', async () => {
    const list = await listApplicants()
    const first = list[0]!
    const originalStage = first.stage
    first.stage = 'rejected'
    first.name = '오염됨'

    const refetched = await getApplicant(first.id)
    expect(refetched.stage).toBe(originalStage)
    expect(refetched.name).not.toBe('오염됨')
  })
})
