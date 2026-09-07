import type { Applicant, Stage } from '../domain/applicant'
import { nextLatencyMs, shouldFail } from './config'
import { ConflictError, NetworkError, NotFoundError } from './errors'
import { readAll, readOne, writeOne } from './store'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 모든 엔드포인트 앞단. 지연을 먼저 흘리고 실패를 판정한다.
 *
 * 설계 판단: 실패는 **쓰기가 반영되기 전에** 일어난다.
 * "서버는 처리했는데 응답만 유실된" 경우까지 흉내내면 낙관적 롤백이
 * 정답 없는 문제가 된다(클라이언트가 반영 여부를 알 방법이 없다).
 * 여기서는 "요청이 서버에 닿지 못했다"로 한정해 롤백 의미를 명확히 유지한다.
 */
async function simulateNetwork(): Promise<void> {
  await sleep(nextLatencyMs())
  if (shouldFail()) throw new NetworkError()
}

export async function listApplicants(): Promise<Applicant[]> {
  await simulateNetwork()
  return readAll()
}

export async function getApplicant(id: string): Promise<Applicant> {
  await simulateNetwork()
  const found = readOne(id)
  if (found === undefined) throw new NotFoundError()
  return found
}

export interface MoveStageInput {
  id: string
  toStage: Stage
  /** 클라이언트가 알고 있는 version. 서버와 다르면 409. */
  expectedVersion: number
}

/**
 * 단계 이동.
 *
 * - 성공 시 version이 +1 되고 stageHistory에 한 건 추가된다.
 * - expectedVersion이 서버와 다르면 ConflictError(409)를 던지고
 *   서버의 현재 상태를 함께 실어 보낸다. 클라이언트는 이걸로 재동기화한다.
 */
export async function moveApplicantStage({
  id,
  toStage,
  expectedVersion,
}: MoveStageInput): Promise<Applicant> {
  await simulateNetwork()

  const current = readOne(id)
  if (current === undefined) throw new NotFoundError()

  if (current.version !== expectedVersion) {
    throw new ConflictError(current)
  }

  // 같은 단계로의 이동은 서버 상태를 바꾸지 않는다. version도 올리지 않는다.
  if (current.stage === toStage) return current

  const next: Applicant = {
    ...current,
    stage: toStage,
    version: current.version + 1,
    stageHistory: [
      ...current.stageHistory,
      { at: new Date().toISOString(), from: current.stage, to: toStage },
    ],
  }

  return writeOne(next)
}
