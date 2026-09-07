/**
 * 검색 문자열 정규화.
 *
 * 대소문자와 공백을 무시한다. 이 함수는 두 곳에서 쓰인다 —
 * ① 로드 시점에 지원자별 검색 인덱스를 만들 때
 * ② 사용자 입력을 질의어로 바꿀 때
 * 양쪽이 같은 규칙을 쓰지 않으면 "공백 무시"가 반쪽만 동작한다.
 */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}
