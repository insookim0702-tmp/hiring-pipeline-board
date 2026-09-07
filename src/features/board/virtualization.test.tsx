import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Applicant } from '../../domain/applicant'
import { makeApplicant, renderBoard } from '../../test/harness'

import * as mocksModule from '../../mocks'

vi.mock('../../mocks', async (importOriginal) => {
  const actual = await importOriginal<typeof mocksModule>()
  return { ...actual, listApplicants: vi.fn(), moveApplicantStage: vi.fn() }
})

const { listApplicants } = mocksModule

/** 컬럼 하나에 40장. 테스트 환경의 컬럼 높이(600px)/카드 높이(84px) 기준으로 다 못 들어간다. */
const MANY: Applicant[] = Array.from({ length: 40 }, (_, index) =>
  makeApplicant({
    id: `s${index}`,
    name: `지원자${String(index).padStart(2, '0')}`,
    stage: 'screening',
  }),
)

beforeEach(() => {
  vi.mocked(listApplicants).mockResolvedValue(MANY)
})

async function setup() {
  const harness = renderBoard()
  await waitFor(() => {
    expect(harness.probe.state().status).toBe('ready')
  })
  return harness
}

function cardButton(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${name},.*상세 보기$`) })
}

describe('가상 스크롤', () => {
  it('전체를 DOM에 올리지 않는다', async () => {
    const { container } = await setup()

    const rendered = container.querySelectorAll('[data-card-id]').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(MANY.length)
  })

  it('컬럼 건수는 렌더된 수가 아니라 실제 건수를 보여준다', async () => {
    await setup()
    expect(screen.getByRole('region', { name: `서류검토 ${MANY.length}명` })).toBeInTheDocument()
  })

  /**
   * 이 커밋의 가장 큰 회귀 위험.
   * 화면 밖 카드는 DOM에 아예 없으므로, 먼저 스크롤해 렌더시키지 않으면
   * `focus()`가 아무 일도 하지 않고 포커스가 `<body>`로 떨어진다.
   */
  it('End 로 화면 밖 마지막 카드까지 포커스가 간다', async () => {
    const user = userEvent.setup()
    const { container } = await setup()

    const lastName = `지원자${String(MANY.length - 1).padStart(2, '0')}`
    // 처음에는 마지막 카드가 렌더되어 있지 않다.
    expect(container.querySelector(`[data-card-id="s${MANY.length - 1}"]`)).toBeNull()

    cardButton('지원자00').focus()
    await user.keyboard('{End}')

    await waitFor(() => {
      expect(cardButton(lastName)).toHaveFocus()
    })
    expect(document.activeElement).not.toBe(document.body)
  })

  it('↓ 를 연속으로 눌러 렌더 범위를 넘어가도 포커스를 잃지 않는다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('지원자00').focus()
    for (let step = 0; step < 20; step += 1) {
      await user.keyboard('{ArrowDown}')
    }

    await waitFor(() => {
      expect(cardButton('지원자20')).toHaveFocus()
    })
  })

  it('필터를 적용하면 가상 목록이 새 결과에 맞춰진다', async () => {
    const user = userEvent.setup()
    const { container } = await setup()

    await user.type(screen.getByRole('searchbox', { name: '이름 검색' }), '지원자03')

    await waitFor(() => {
      expect(screen.getByRole('region', { name: '서류검토 1명' })).toBeInTheDocument()
    })
    expect(container.querySelectorAll('[data-card-id]')).toHaveLength(1)
  })
})
