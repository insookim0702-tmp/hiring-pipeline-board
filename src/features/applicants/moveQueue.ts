import type { Applicant, Stage } from '../../domain/applicant'
import { ConflictError } from '../../mocks'

export interface MoveQueueDeps {
  /** 큐가 처음 이 카드를 다룰 때 기준 version을 읽어온다. */
  readVersion: (id: string) => number | undefined
  send: (id: string, toStage: Stage, expectedVersion: number) => Promise<Applicant>
  onConfirmed: (id: string, applicant: Applicant) => void
  onConflict: (id: string, serverCurrent: Applicant, intendedStage: Stage) => void
  onFailed: (id: string, error: unknown, intendedStage: Stage) => void
  /** 병합되어 서버로 보내지 않은 중간 단계. 이력에 남지 않으므로 알려준다. */
  onCoalesced?: (id: string, skippedStage: Stage) => void
}

interface CardQueue {
  /** 아직 서버로 보내지 않은 "마지막 의도". 중간 의도는 여기서 덮어써진다. */
  pendingTarget: Stage | null
  /** 요청 순번. 응답이 도착했을 때 이 값과 비교해 낡은 응답을 걸러낸다. */
  seq: number
  /**
   * 서버가 마지막으로 알려준 version.
   *
   * React 상태에서 매번 읽지 않는 이유: 큐는 응답 직후 곧바로 다음 요청을 보내는데,
   * 그 시점에는 아직 React가 커밋하지 않아 스토어를 읽으면 낡은 version이 나온다.
   * 큐가 직접 들고 있으면 그 타이밍 의존이 사라진다.
   */
  version: number
  running: boolean
}

export interface MoveQueue {
  enqueue: (id: string, toStage: Stage) => void
  /** 테스트/디버그용 스냅샷. */
  inspect: (id: string) => { pendingTarget: Stage | null; seq: number; version: number } | undefined
}

/**
 * 카드 단위 이동 요청 큐.
 *
 * 해결하는 문제 세 가지:
 *
 * 1) **직렬화** — 같은 카드의 요청이 병렬로 나가면 둘 다 같은 `expectedVersion`을
 *    들고 가고, 하나가 성공하는 순간 나머지는 409로 죽는다(= 마지막 의도 유실).
 *    카드별로 순차 실행하고, **다른 카드는 그대로 병렬**로 둔다.
 *
 * 2) **병합** — 대기 중인 같은 카드의 이동은 마지막 의도만 남긴다.
 *    서류검토 → 면접 → 처우협의를 빠르게 누르면 "면접"을 서버에 보낼 이유가 없다.
 *    단, 그 중간 단계는 `stageHistory`에 남지 않는다 — 의도적 트레이드오프이고
 *    `onCoalesced`로 호출부에 알린다.
 *
 * 3) **낡은 응답 차단** — 응답이 도착했을 때 더 새로운 의도가 이미 대기 중이면
 *    그 응답으로 화면을 확정하지 않는다(version만 갱신하고 다음 요청으로 넘어간다).
 *
 * 리듀서 밖의 순수 모듈로 뺐다. React 없이 단위 테스트할 수 있어야 하기 때문이다.
 */
export function createMoveQueue(deps: MoveQueueDeps): MoveQueue {
  const queues = new Map<string, CardQueue>()

  function drain(id: string): void {
    const queue = queues.get(id)
    if (queue === undefined || queue.running) return
    queue.running = true

    void (async () => {
      while (queue.pendingTarget !== null) {
        const target = queue.pendingTarget
        queue.pendingTarget = null
        const sentSeq = queue.seq

        try {
          const applicant = await deps.send(id, target, queue.version)
          queue.version = applicant.version

          // 응답을 기다리는 동안 더 새로운 의도가 들어왔다면 이 응답으로 확정하지 않는다.
          // (확정해 버리면 낡은 상태가 최신 낙관적 상태를 덮어쓴다)
          if (queue.pendingTarget !== null || queue.seq !== sentSeq) continue

          deps.onConfirmed(id, applicant)
        } catch (error) {
          if (error instanceof ConflictError) {
            queue.version = error.current.version
            // 남은 의도를 버린다. 서버 상태가 내가 알던 것과 다르므로
            // 내 의도를 그대로 재적용하는 건 위험하다. (재시도 정책: 하지 않는다)
            queue.pendingTarget = null
            deps.onConflict(id, error.current, target)
          } else {
            queue.pendingTarget = null
            deps.onFailed(id, error, target)
          }
          break
        }
      }

      queue.running = false
      // 큐를 비운다. 다음 이동은 스토어에서 version을 다시 읽는다
      // (성공했으면 onConfirmed가, 실패했으면 롤백이 스토어를 이미 맞춰 놓았다).
      if (queue.pendingTarget === null) queues.delete(id)
    })()
  }

  return {
    enqueue: (id, toStage) => {
      let queue = queues.get(id)

      if (queue === undefined) {
        const version = deps.readVersion(id)
        if (version === undefined) return
        queue = { pendingTarget: null, seq: 0, version, running: false }
        queues.set(id, queue)
      }

      if (queue.pendingTarget !== null && queue.pendingTarget !== toStage) {
        deps.onCoalesced?.(id, queue.pendingTarget)
      }

      queue.pendingTarget = toStage
      queue.seq += 1
      drain(id)
    },

    inspect: (id) => {
      const queue = queues.get(id)
      if (queue === undefined) return undefined
      return { pendingTarget: queue.pendingTarget, seq: queue.seq, version: queue.version }
    },
  }
}
