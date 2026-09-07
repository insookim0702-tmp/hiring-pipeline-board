import type { Applicant, Stage } from '../domain/applicant'
import { createRng, intBetween, pick } from './random'

const SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
  '황',
  '안',
  '송',
  '류',
  '전',
] as const

const GIVEN_FIRST = [
  '민',
  '서',
  '지',
  '현',
  '준',
  '예',
  '수',
  '하',
  '유',
  '재',
  '성',
  '은',
  '도',
  '주',
  '태',
  '건',
] as const

const GIVEN_SECOND = [
  '준',
  '아',
  '우',
  '연',
  '호',
  '진',
  '빈',
  '영',
  '서',
  '희',
  '원',
  '환',
  '규',
  '람',
  '훈',
] as const

export const POSITIONS = [
  '프론트엔드 개발',
  '백엔드 개발',
  '모바일 개발',
  '데이터 엔지니어',
  'ML 엔지니어',
  'DevOps',
  'QA 엔지니어',
  '프로덕트 디자이너',
  '프로덕트 매니저',
  '테크니컬 라이터',
] as const

/**
 * 단계 분포. 실제 파이프라인처럼 앞단이 두껍고 뒤로 갈수록 얇아지게 했다.
 * 전부 균등하면 "필터 결과 0건", "특정 컬럼 0건" 같은 상태를 만나기 어렵다.
 */
const STAGE_WEIGHTS: ReadonlyArray<readonly [Stage, number]> = [
  ['screening', 0.42],
  ['interview', 0.24],
  ['offer', 0.12],
  ['hired', 0.1],
  ['rejected', 0.12],
]

function pickStage(rng: () => number): Stage {
  const roll = rng()
  let acc = 0
  for (const [stage, weight] of STAGE_WEIGHTS) {
    acc += weight
    if (roll < acc) return stage
  }
  return 'screening'
}

const SUMMARY_TEMPLATES = [
  '{years}년차. {position} 경력. 대규모 트래픽 서비스 경험 보유.',
  '{years}년차 {position}. 스타트업 초기 멤버로 제품 0→1 경험.',
  '{years}년차. {position} 직무로 사내 플랫폼 개편 주도.',
  '{years}년차 {position}. 오픈소스 기여 이력 있음.',
  '{years}년차. {position} 및 팀 리드 경험.',
] as const

const MEMOS = [
  '1차 통화 완료. 커뮤니케이션 좋음.',
  '포트폴리오 검토 필요.',
  '희망 연봉 확인 필요.',
  '레퍼런스 체크 예정.',
  '기술 과제 제출 대기 중.',
  '',
  '',
] as const

/** 지원일 기준 오늘. 시드 데이터가 흔들리지 않도록 고정 날짜를 쓴다. */
const SEED_TODAY = new Date('2026-09-07T00:00:00.000Z').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 시드 고정 생성. 같은 (seed, count)로 부르면 항상 같은 결과가 나와야 한다.
 * `Math.random`이나 `Date.now()`가 섞이면 그 성질이 깨진다.
 */
export function generateApplicants(seed: number, count: number): Applicant[] {
  const rng = createRng(seed)
  const applicants: Applicant[] = []

  for (let i = 0; i < count; i += 1) {
    const name = `${pick(rng, SURNAMES)}${pick(rng, GIVEN_FIRST)}${pick(rng, GIVEN_SECOND)}`
    const position = pick(rng, POSITIONS)
    const stage = pickStage(rng)
    const experienceYears = intBetween(rng, 0, 15)
    const daysAgo = intBetween(rng, 0, 89)
    const appliedAt = new Date(SEED_TODAY - daysAgo * DAY_MS).toISOString()

    const summary = pick(rng, SUMMARY_TEMPLATES)
      .replace('{years}', String(Math.max(1, experienceYears)))
      .replace('{position}', position)

    applicants.push({
      id: `apl-${String(i + 1).padStart(5, '0')}`,
      name,
      position,
      appliedAt,
      stage,
      version: 1,
      email: `applicant${i + 1}@example.com`,
      phone: `010-${String(intBetween(rng, 1000, 9999))}-${String(intBetween(rng, 1000, 9999))}`,
      experienceYears,
      resumeSummary: summary,
      memo: pick(rng, MEMOS),
      // 최초 지원 이력 한 건. from이 null이면 지원 시점이라는 뜻.
      stageHistory: [{ at: appliedAt, from: null, to: stage }],
    })
  }

  return applicants
}
