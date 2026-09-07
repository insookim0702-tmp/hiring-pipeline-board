import type { Applicant } from '../domain/applicant'

/**
 * mock 서버가 던지는 에러들. 실제 HTTP 상태코드에 대응시켜 두었다.
 * 호출부가 `instanceof`로 구분해서 서로 다르게 처리할 수 있어야 한다 —
 * 특히 ConflictError(409)는 "롤백"이 아니라 "서버 상태로 재동기화"가 정답이다.
 */
export class MockApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = new.target.name
    this.status = status
  }
}

/** 네트워크/서버 장애 시뮬레이션. 요청은 서버에 반영되지 않았다. */
export class NetworkError extends MockApiError {
  constructor(message = '네트워크 오류로 요청을 처리하지 못했습니다.') {
    super(503, message)
  }
}

export class NotFoundError extends MockApiError {
  constructor(message = '지원자를 찾을 수 없습니다.') {
    super(404, message)
  }
}

/**
 * 버전 충돌. 다른 요청이 먼저 이 카드를 바꿨다는 뜻이다.
 * 클라이언트가 원상 복구할 근거로 쓸 수 있도록 서버의 현재 상태를 함께 실어 보낸다.
 */
export class ConflictError extends MockApiError {
  readonly current: Applicant

  constructor(current: Applicant, message = '다른 변경이 먼저 반영되어 요청이 거부되었습니다.') {
    super(409, message)
    this.current = current
  }
}
