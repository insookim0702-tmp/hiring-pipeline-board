import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Applicant, Stage } from '../../domain/applicant'
import { columnOf, makeApplicant, renderBoard } from '../../test/harness'

/**
 * mock 서버를 그대로 쓰지 않고 여기서만 대체한다.
 *
 * 이유: 이 파일이 검증하려는 건 "응답 순서·타이밍에 따른 스토어의 행동"이다.
 * 실제 mock 서버는 지연이 랜덤(200~800ms)이라 응답 도착 순서를 뒤집을 수 없다.
 * 그래서 요청마다 수동으로 resolve/reject할 수 있는 deferred를 쓴다.
 * (`ConflictError` 등 에러 타입은 실제 구현을 그대로 가져다 쓴다 —
 *  Provider가 `instanceof`로 분기하므로 진짜 클래스여야 한다.)
 */
import * as mocksModule from '../../mocks'

vi.mock('../../mocks', async (importOriginal) => {
  const actual = await importOriginal<typeof mocksModule>()
  return { ...actual, listApplicants: vi.fn(), moveApplicantStage: vi.fn() }
})

// `vi.mock`은 import보다 위로 호이스팅되므로 위의 정적 import가 이미 대체된 모듈을 가리킨다.
const { listApplicants, moveApplicantStage, ConflictError, NetworkError } = mocksModule

interface Deferred {
  input: { id: string; toStage: Stage; expectedVersion: number }
  resolve: (applicant: Applicant) => void
  reject: (error: unknown) => void
}

let moveCalls: Deferred[] = []

beforeEach(() => {
  moveCalls = []
  vi.mocked(moveApplicantStage).mockImplementation(
    (input) =>
      new Promise<Applicant>((resolve, reject) => {
        moveCalls.push({ input, resolve, reject })
      }),
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

async function setup(applicants: Applicant[]) {
  vi.mocked(listApplicants).mockResolvedValue(applicants)
  const harness = renderBoard()
  await waitFor(() => {
    expect(harness.probe.state().status).toBe('ready')
  })
  return harness
}

describe('1) 낙관적 반영', () => {
  it('API가 아직 응답하지 않은 시점에 이미 목표 단계에 있다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening' })])

    act(() => {
      probe.moveStage('a1', 'interview')
    })

    // 이 시점에 서버는 아무것도 응답하지 않았다 — deferred가 그대로 대기 중이다.
    expect(moveCalls).toHaveLength(1)
    expect(moveCalls[0]?.resolve).toBeTypeOf('function')

    // 그런데 화면은 이미 옮겨져 있다.
    expect(columnOf(container, '홍길동')).toBe('면접 1명')
    expect(probe.state().byId['a1']?.stage).toBe('interview')
    expect(probe.state().pendingMoves['a1']).toBeDefined()
  })

  it('요청에 현재 version을 실어 보낸다', async () => {
    const { probe } = await setup([makeApplicant({ version: 7 })])

    act(() => {
      probe.moveStage('a1', 'interview')
    })

    expect(moveCalls[0]?.input).toMatchObject({
      id: 'a1',
      toStage: 'interview',
      expectedVersion: 7,
    })
  })
})

describe('2) 실패 시 롤백 + 피드백', () => {
  it('원래 단계로 되돌리고 에러 토스트를 띄운다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening' })])

    act(() => {
      probe.moveStage('a1', 'rejected')
    })
    expect(columnOf(container, '홍길동')).toBe('불합격 1명')

    await act(async () => {
      moveCalls[0]?.reject(new NetworkError())
    })

    expect(columnOf(container, '홍길동')).toBe('서류검토 1명')
    expect(probe.state().byId['a1']?.stage).toBe('screening')
    expect(probe.state().pendingMoves['a1']).toBeUndefined()

    // 스크린리더 안내는 Announcer가 단독으로 담당한다(토스트에는 live role이 없다).
    const liveRegion = await screen.findByText(/옮기지 못했습니다/, {
      selector: '[aria-live="assertive"]',
    })
    expect(liveRegion).toHaveTextContent('서류검토 단계로 되돌렸습니다')

    // 시각 표현(토스트)도 함께 떠야 한다.
    expect(screen.getByText(/님을 불합격\(으\)로 옮기지 못했습니다/)).toBeInTheDocument()
  })
})

describe('5) 버전 충돌은 롤백이 아니라 재동기화', () => {
  it('스냅샷이 아니라 서버가 준 단계로 맞춘다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    act(() => {
      probe.moveStage('a1', 'hired')
    })
    expect(columnOf(container, '홍길동')).toBe('최종합격 1명')

    // 서버는 그 사이 offer/version 2가 되어 있었다.
    const serverCurrent = makeApplicant({ stage: 'offer', version: 2 })
    await act(async () => {
      moveCalls[0]?.reject(new ConflictError(serverCurrent))
    })

    // 롤백이라면 '서류검토'. 재동기화이므로 '처우협의'.
    expect(columnOf(container, '홍길동')).toBe('처우협의 1명')
    expect(probe.state().byId['a1']?.version).toBe(2)
  })
})

describe('연속 이동에서 version 최신성', () => {
  /**
   * `moveStage`는 `stateRef`(useEffect로 갱신)에서 현재 version을 읽는다.
   * ref가 한 커밋 뒤처지면 확정 직후의 이동이 낡은 version을 보내 헛된 409가 난다.
   * 그 지연이 실제로 존재하는지 확인한다.
   */
  it('확정 직후 이동은 서버가 준 새 version을 실어 보낸다', async () => {
    const { probe } = await setup([makeApplicant({ version: 1 })])

    act(() => {
      probe.moveStage('a1', 'interview')
    })
    expect(moveCalls[0]?.input.expectedVersion).toBe(1)

    await act(async () => {
      moveCalls[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    })
    expect(probe.state().byId['a1']?.version).toBe(2)

    act(() => {
      probe.moveStage('a1', 'offer')
    })
    expect(moveCalls[1]?.input.expectedVersion).toBe(2)
  })
})

/**
 * 아래 두 블록은 **현재 구현에서 실패한다.** 의도적으로 실패한 채 커밋한다.
 *
 * `it.skip`이나 `it.todo`로 숨기지 않는 이유: 숨기면 "구현이 안 된 것"과
 * "테스트를 안 쓴 것"이 구별되지 않는다. 빨간 상태로 두면 커밋 히스토리에
 * 무엇이 미해결인지 그대로 남는다. 커밋 11(race-condition)에서 통과시킨다.
 */
describe('3) 같은 카드 빠른 연속 이동 [커밋 11에서 해결 예정]', () => {
  it('최종 상태가 마지막 의도와 일치한다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    // 응답을 기다리지 않고 두 번 연속 이동.
    act(() => {
      probe.moveStage('a1', 'interview')
    })
    act(() => {
      probe.moveStage('a1', 'offer')
    })

    // 첫 요청이 성공한다 (서버 version 2).
    await act(async () => {
      moveCalls[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    })

    // 두 번째 요청은 낡은 expectedVersion(1)을 들고 갔으므로 서버가 409로 거부한다.
    if (moveCalls[1] !== undefined) {
      await act(async () => {
        moveCalls[1]?.reject(new ConflictError(makeApplicant({ stage: 'interview', version: 2 })))
      })
    }

    // 마지막 의도는 '처우협의'였다.
    expect(probe.state().byId['a1']?.stage).toBe('offer')
    expect(columnOf(container, '홍길동')).toBe('처우협의 1명')
  })
})

describe('4) 늦게 도착한 응답 [커밋 11에서 해결 예정]', () => {
  it('낡은 응답이 최신 상태를 덮어쓰지 않는다', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    act(() => {
      probe.moveStage('a1', 'interview')
    })
    act(() => {
      probe.moveStage('a1', 'offer')
    })

    expect(moveCalls).toHaveLength(2)

    // 두 번째(최신) 요청이 먼저 도착한다.
    await act(async () => {
      moveCalls[1]?.resolve(makeApplicant({ stage: 'offer', version: 2 }))
    })
    expect(probe.state().byId['a1']?.stage).toBe('offer')

    // 첫 번째(낡은) 응답이 뒤늦게 도착한다. 이걸 반영하면 안 된다.
    await act(async () => {
      moveCalls[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    })

    expect(probe.state().byId['a1']?.stage).toBe('offer')
  })
})
