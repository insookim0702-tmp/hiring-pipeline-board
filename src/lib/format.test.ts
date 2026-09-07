import { describe, expect, it } from 'vitest'
import { formatAppliedDate } from './format'

describe('formatAppliedDate', () => {
  it('YYYY.MM.DD 형태로 만든다', () => {
    expect(formatAppliedDate('2026-09-07T00:00:00.000Z')).toBe('2026.09.07')
  })

  it('한 자리 월/일도 두 자리로 채운다', () => {
    expect(formatAppliedDate('2026-01-03T12:00:00.000Z')).toBe('2026.01.03')
  })

  it('ko-KR 로케일이 넣는 공백과 끝 점을 남기지 않는다', () => {
    const formatted = formatAppliedDate('2026-12-25T09:00:00.000Z')
    expect(formatted).not.toMatch(/\s/)
    expect(formatted).not.toMatch(/\.$/)
  })
})
