/**
 * mock 서버 설정. 테스트에서 지연·실패를 결정론적으로 만들기 위해
 * 전역 `Math.random`을 몽키패치하지 않고 여기에 명시적으로 주입한다.
 */
export interface MockConfig {
  /** 응답 지연 하한(ms) */
  minLatencyMs: number
  /** 응답 지연 상한(ms) */
  maxLatencyMs: number
  /** 실패 확률 0~1. 1이면 항상 실패, 0이면 절대 실패하지 않는다. */
  failureRate: number
  /** 시드 데이터 생성용 시드 */
  seed: number
  /** 생성할 지원자 수 */
  count: number
  /** 지연·실패 판정용 난수. 테스트에서 교체 가능. */
  random: () => number
}

const DEFAULT_COUNT = 200
const DEFAULT_FAILURE_RATE = 0.15

function searchParams(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

/**
 * 건수는 `?count=1000` 쿼리스트링으로 전환한다.
 * 성능 비교(200건 / 1000건)를 URL만 바꿔서 재현할 수 있게 하려는 것이다.
 * `?count=0`은 "지원자 0건" 빈 상태를 재현하는 데 쓴다.
 */
function countFromLocation(): number {
  const params = searchParams()
  if (params === null) return DEFAULT_COUNT
  const raw = params.get('count')
  if (raw === null) return DEFAULT_COUNT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_COUNT
  return Math.min(parsed, 5000)
}

/**
 * 실패율을 `?fail=1` (항상 실패) / `?fail=0` (절대 실패 안 함)으로 덮어쓴다.
 *
 * 15%는 "때로 실패"라서 에러 UI와 롤백을 눈으로 확인하기 어렵다.
 * 평가자도 같은 방법으로 재현할 수 있어야 하므로 URL로 열어 두었다.
 */
function failureRateFromLocation(): number {
  const params = searchParams()
  if (params === null) return DEFAULT_FAILURE_RATE
  const raw = params.get('fail')
  if (raw === null) return DEFAULT_FAILURE_RATE
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return DEFAULT_FAILURE_RATE
  return parsed
}

function createDefaults(): MockConfig {
  return {
    minLatencyMs: 200,
    maxLatencyMs: 800,
    failureRate: failureRateFromLocation(),
    seed: 20260907,
    count: countFromLocation(),
    random: Math.random,
  }
}

let config: MockConfig = createDefaults()

export function getMockConfig(): Readonly<MockConfig> {
  return config
}

export function configureMock(patch: Partial<MockConfig>): void {
  config = { ...config, ...patch }
}

export function resetMockConfig(): void {
  config = createDefaults()
}

/**
 * 200~800ms 지연.
 *
 * 주의: `random() * maxLatencyMs`로 쓰면 0ms도 나온다. 요구사항은 "200~800ms"이므로
 * 하한을 더한 폭으로 계산해야 한다.
 */
export function nextLatencyMs(): number {
  const { minLatencyMs, maxLatencyMs, random } = config
  return minLatencyMs + random() * (maxLatencyMs - minLatencyMs)
}

export function shouldFail(): boolean {
  const { failureRate, random } = config
  if (failureRate <= 0) return false
  if (failureRate >= 1) return true
  return random() < failureRate
}
