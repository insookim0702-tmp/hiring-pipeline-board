import { describe, expect, it, vi } from 'vitest'
import type { Applicant, Stage } from '../../domain/applicant'
import { ConflictError, NetworkError } from '../../mocks'
import { makeApplicant } from '../../test/harness'
import { createMoveQueue, type MoveQueueDeps } from './moveQueue'

interface Pending {
  id: string
  toStage: Stage
  expectedVersion: number
  resolve: (applicant: Applicant) => void
  reject: (error: unknown) => void
}

/**
 * 큐를 React 없이 단위 테스트한다.
 *
 * 리듀서 밖 순수 모듈로 뺀 이유가 이것이다 — 응답 도착 순서를 손으로 조작해야
 * 순번 가드를 검증할 수 있고, 그건 컴포넌트 트리를 세우지 않는 게 훨씬 명확하다.
 */
function harness(versions: Record<string, number> = { a1: 1 }) {
  const sent: Pending[] = []
  const confirmed: Array<{ id: string; stage: Stage; version: number }> = []
  const conflicts: Array<{ id: string; serverStage: Stage; intended: Stage }> = []
  const failures: Array<{ id: string; intended: Stage }> = []
  const coalesced: Array<{ id: string; skipped: Stage }> = []

  const deps: MoveQueueDeps = {
    readVersion: (id) => versions[id],
    send: (id, toStage, expectedVersion) =>
      new Promise<Applicant>((resolve, reject) => {
        sent.push({ id, toStage, expectedVersion, resolve, reject })
      }),
    onConfirmed: (id, applicant) => {
      confirmed.push({ id, stage: applicant.stage, version: applicant.version })
      // 실제 Provider는 여기서 스토어를 갱신한다. harness도 같게 흉내낸다 —
      // 큐는 다 처리하면 스스로 비워지고 다음 이동에서 스토어를 다시 읽기 때문에,
      // 스토어 갱신을 흉내내지 않으면 version 전파를 검증할 수 없다.
      versions[id] = applicant.version
    },
    onConflict: (id, serverCurrent, intendedStage) => {
      conflicts.push({ id, serverStage: serverCurrent.stage, intended: intendedStage })
      // MOVE_RESYNC가 스토어를 서버 상태로 맞추는 것에 해당.
      versions[id] = serverCurrent.version
    },
    onFailed: (id, _error, intendedStage) => {
      failures.push({ id, intended: intendedStage })
    },
    onCoalesced: (id, skippedStage) => {
      coalesced.push({ id, skipped: skippedStage })
    },
  }

  return { queue: createMoveQueue(deps), sent, confirmed, conflicts, failures, coalesced }
}

/** 마이크로태스크를 흘려 큐의 `await` 체인을 진행시킨다. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('직렬화', () => {
  it('같은 카드는 한 번에 하나만 보낸다', async () => {
    const { queue, sent } = harness()

    queue.enqueue('a1', 'interview')
    queue.enqueue('a1', 'offer')
    queue.enqueue('a1', 'hired')
    await flush()

    expect(sent).toHaveLength(1)
    expect(sent[0]?.toStage).toBe('interview')
  })

  it('다른 카드는 병렬로 보낸다', async () => {
    const { queue, sent } = harness({ a1: 1, a2: 5 })

    queue.enqueue('a1', 'interview')
    queue.enqueue('a2', 'hired')
    await flush()

    expect(sent).toHaveLength(2)
    expect(sent.map((item) => item.id)).toEqual(['a1', 'a2'])
    // 카드별 기준 version을 각각 읽어 간다
    expect(sent[1]?.expectedVersion).toBe(5)
  })
})

describe('병합', () => {
  it('대기 중 의도는 마지막 것만 남고, 건너뛴 단계를 알려준다', async () => {
    const { queue, sent, coalesced } = harness()

    queue.enqueue('a1', 'interview')
    await flush()
    queue.enqueue('a1', 'offer')
    queue.enqueue('a1', 'hired')

    expect(coalesced).toEqual([{ id: 'a1', skipped: 'offer' }])

    sent[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    await flush()

    // 'offer'는 서버에 가지 않고 'hired'만 나간다
    expect(sent).toHaveLength(2)
    expect(sent[1]?.toStage).toBe('hired')
  })
})

describe('version 전파', () => {
  it('다음 요청은 직전 응답의 version을 실어 보낸다', async () => {
    const { queue, sent } = harness()

    queue.enqueue('a1', 'interview')
    await flush()
    expect(sent[0]?.expectedVersion).toBe(1)

    queue.enqueue('a1', 'offer')
    sent[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    await flush()

    expect(sent[1]?.expectedVersion).toBe(2)
  })
})

describe('낡은 응답 차단', () => {
  it('대기 중 의도가 있으면 도착한 응답을 확정하지 않는다', async () => {
    const { queue, sent, confirmed } = harness()

    queue.enqueue('a1', 'interview')
    await flush()
    queue.enqueue('a1', 'offer')

    sent[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    await flush()

    // 'interview' 확정은 일어나지 않는다
    expect(confirmed).toHaveLength(0)

    sent[1]?.resolve(makeApplicant({ stage: 'offer', version: 3 }))
    await flush()

    expect(confirmed).toEqual([{ id: 'a1', stage: 'offer', version: 3 }])
  })
})

describe('실패 처리', () => {
  it('네트워크 실패는 남은 의도를 버리고 onFailed를 부른다', async () => {
    const { queue, sent, failures, confirmed } = harness()

    queue.enqueue('a1', 'interview')
    await flush()
    queue.enqueue('a1', 'offer')

    sent[0]?.reject(new NetworkError())
    await flush()

    expect(failures).toEqual([{ id: 'a1', intended: 'interview' }])
    // 대기 중이던 'offer'를 보내지 않는다 — 이미 롤백했으므로.
    expect(sent).toHaveLength(1)
    expect(confirmed).toHaveLength(0)
  })

  it('409는 롤백이 아니라 재동기화로 보고하고 재시도하지 않는다', async () => {
    const { queue, sent, conflicts, failures } = harness()

    queue.enqueue('a1', 'hired')
    await flush()

    sent[0]?.reject(new ConflictError(makeApplicant({ stage: 'offer', version: 9 })))
    await flush()

    expect(failures).toHaveLength(0)
    expect(conflicts).toEqual([{ id: 'a1', serverStage: 'offer', intended: 'hired' }])
    // 무한 재시도 방지: 자동 재시도 자체를 하지 않는다.
    expect(sent).toHaveLength(1)
  })

  /**
   * 처음엔 "큐가 409에서 받은 version을 들고 있다가 다음 요청에 쓴다"를 단정했다가 실패했다.
   * 큐는 처리가 끝나면 **스스로 비워지고** 다음 이동에서 스토어의 version을 다시 읽는다.
   * (그게 맞는 설계다 — 큐가 version을 무기한 들고 있으면 다른 경로로 바뀐 서버 상태를
   *  영원히 모르게 된다) 그래서 검증 대상은 "재동기화 → 스토어 갱신 → 다음 요청 반영"의
   * 연결이고, harness가 그 연결(onConflict에서 스토어 갱신)을 흉내내야 한다.
   */
  it('409 이후의 새 이동은 재동기화된 version으로 나간다', async () => {
    const { queue, sent } = harness()

    queue.enqueue('a1', 'hired')
    await flush()
    sent[0]?.reject(new ConflictError(makeApplicant({ stage: 'offer', version: 9 })))
    await flush()

    queue.enqueue('a1', 'rejected')
    await flush()

    expect(sent).toHaveLength(2)
    expect(sent[1]?.expectedVersion).toBe(9)
  })
})

describe('경계', () => {
  it('스토어에 없는 카드는 요청하지 않는다', async () => {
    const { queue, sent } = harness({})
    queue.enqueue('nope', 'interview')
    await flush()
    expect(sent).toHaveLength(0)
    expect(queue.inspect('nope')).toBeUndefined()
  })

  it('열 번 연속 이동해도 서버 왕복은 두 번뿐이다', async () => {
    const { queue, sent, confirmed } = harness()
    const targets: Stage[] = [
      'interview',
      'offer',
      'hired',
      'rejected',
      'interview',
      'offer',
      'hired',
      'rejected',
      'interview',
      'hired',
    ]

    for (const target of targets) queue.enqueue('a1', target)
    await flush()
    expect(sent).toHaveLength(1)

    sent[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    await flush()

    expect(sent).toHaveLength(2)
    expect(sent[1]?.toStage).toBe('hired') // 마지막 의도
    sent[1]?.resolve(makeApplicant({ stage: 'hired', version: 3 }))
    await flush()

    expect(confirmed).toEqual([{ id: 'a1', stage: 'hired', version: 3 }])
  })
})

describe('진행 후 정리', () => {
  it('모두 처리되면 큐를 비운다 (다음 이동은 스토어에서 version을 다시 읽는다)', async () => {
    const versions: Record<string, number> = { a1: 1 }
    const sent: Pending[] = []
    const queue = createMoveQueue({
      readVersion: (id) => versions[id],
      send: (id, toStage, expectedVersion) =>
        new Promise<Applicant>((resolve, reject) => {
          sent.push({ id, toStage, expectedVersion, resolve, reject })
        }),
      onConfirmed: (_id, applicant) => {
        versions['a1'] = applicant.version
      },
      onConflict: vi.fn(),
      onFailed: vi.fn(),
    })

    queue.enqueue('a1', 'interview')
    await flush()
    sent[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    await flush()

    expect(queue.inspect('a1')).toBeUndefined()

    queue.enqueue('a1', 'offer')
    await flush()
    expect(sent[1]?.expectedVersion).toBe(2)
  })
})
