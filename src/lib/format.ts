/**
 * 날짜 포맷터.
 *
 * `Intl.DateTimeFormat` 인스턴스 생성은 싸지 않다. 카드 렌더 안에서 매번 만들면
 * 1,000건에서 그대로 비용이 된다. 모듈 스코프에서 한 번만 만들어 재사용한다.
 */
const appliedDateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** ISO 문자열 → `2026.09.07` */
export function formatAppliedDate(iso: string): string {
  // ko-KR은 "2026. 09. 07." 형태로 준다. 공백(NBSP 포함)과 끝 점을 정리한다.
  return appliedDateFormatter.format(new Date(iso)).replace(/\s/g, '').replace(/\.$/, '')
}

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** 상세 패널의 이동 이력용. `2026.09.07 14:32` */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}
