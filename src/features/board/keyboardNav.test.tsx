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

const { listApplicants, moveApplicantStage } = mocksModule

/**
 * 키보드 조작은 브라우저 자동화로 검증할 수 없었다 — 사용한 자동화 패널이
 * 방향키/Escape를 자체적으로 삼켜서 페이지에 keydown이 도달하지 않았다
 * (`document`에 프로브를 달아 이벤트 0건을 확인). Tab만 전달됐다.
 * 그래서 jsdom + user-event로 옮겼다. 회귀 감지도 함께 얻는다.
 */
const FIXTURE: Applicant[] = [
  makeApplicant({ id: 's1', name: '서류일', stage: 'screening' }),
  makeApplicant({ id: 's2', name: '서류이', stage: 'screening' }),
  makeApplicant({ id: 's3', name: '서류삼', stage: 'screening' }),
  makeApplicant({ id: 'i1', name: '면접일', stage: 'interview' }),
  makeApplicant({ id: 'i2', name: '면접이', stage: 'interview' }),
  // 처우협의는 비워 둔다 — ← → 이동이 빈 컬럼을 건너뛰는지 보기 위해
  makeApplicant({ id: 'h1', name: '합격일', stage: 'hired' }),
]

beforeEach(() => {
  vi.mocked(listApplicants).mockResolvedValue(FIXTURE)
  vi.mocked(moveApplicantStage).mockImplementation((input) =>
    Promise.resolve(
      makeApplicant({
        id: input.id,
        name: FIXTURE.find((a) => a.id === input.id)?.name ?? '',
        stage: input.toStage,
        version: input.expectedVersion + 1,
      }),
    ),
  )
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

describe('roving tabindex', () => {
  it('컬럼당 카드 Tab 스톱이 하나뿐이다', async () => {
    const { container } = await setup()

    const cards = container.querySelectorAll('[data-card-id]')
    expect(cards).toHaveLength(6)

    const tabbableCards = container.querySelectorAll('[data-card-focus][tabindex="0"]')
    // 비어 있지 않은 컬럼 3개(서류검토/면접/최종합격) → 3개
    expect(tabbableCards).toHaveLength(3)
  })

  it('포커스가 옮겨가면 그 카드가 컬럼의 Tab 스톱이 된다', async () => {
    const user = userEvent.setup()
    const { container } = await setup()

    cardButton('서류일').focus()
    await user.keyboard('{ArrowDown}')

    expect(cardButton('서류이')).toHaveFocus()
    expect(cardButton('서류이')).toHaveAttribute('tabindex', '0')
    expect(cardButton('서류일')).toHaveAttribute('tabindex', '-1')
    // 여전히 컬럼당 하나다
    expect(container.querySelectorAll('[data-card-focus][tabindex="0"]')).toHaveLength(3)
  })
})

describe('방향키 이동', () => {
  it('↓ 는 같은 컬럼의 다음 카드로 간다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류일').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(cardButton('서류삼')).toHaveFocus()
  })

  it('컬럼 끝에서 ↓ 를 더 눌러도 다음 컬럼으로 넘어가지 않는다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류삼').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(cardButton('서류삼')).toHaveFocus()
  })

  it('↑ 는 이전 카드로, 맨 위에서는 멈춘다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류이').focus()
    await user.keyboard('{ArrowUp}')
    expect(cardButton('서류일')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(cardButton('서류일')).toHaveFocus()
  })

  it('→ 는 같은 행 위치를 유지하며 다음 컬럼으로 간다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류이').focus() // index 1
    await user.keyboard('{ArrowRight}')
    expect(cardButton('면접이')).toHaveFocus() // 면접 컬럼의 index 1
  })

  it('→ 는 빈 컬럼(처우협의)을 건너뛴다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('면접일').focus()
    await user.keyboard('{ArrowRight}')
    // 처우협의는 0건이므로 최종합격으로 간다
    expect(cardButton('합격일')).toHaveFocus()
  })

  it('행 위치가 대상 컬럼보다 크면 마지막 카드로 붙는다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류삼').focus() // index 2
    await user.keyboard('{ArrowRight}') // 면접 컬럼은 2장뿐
    expect(cardButton('면접이')).toHaveFocus()
  })

  it('End / Home 은 컬럼의 끝 / 처음으로 간다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류일').focus()
    await user.keyboard('{End}')
    expect(cardButton('서류삼')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(cardButton('서류일')).toHaveFocus()
  })
})

describe('키보드로 상세 열기', () => {
  it('Enter 로 상세 패널이 열린다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('면접일').focus()
    await user.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('면접일')
  })

  it('닫으면 원래 카드로 포커스가 돌아온다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('면접일').focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: '닫기' }))

    await waitFor(() => {
      expect(cardButton('면접일')).toHaveFocus()
    })
  })
})

describe('키보드로 단계 이동', () => {
  it('M → ↓ → Enter 로 단계를 옮긴다', async () => {
    const user = userEvent.setup()
    const { probe } = await setup()

    cardButton('서류일').focus()
    await user.keyboard('m')

    const menu = await screen.findByRole('menu', { name: '서류일 이동할 단계' })
    // 열리면 첫 활성 항목으로 포커스가 간다 (현재 단계는 disabled)
    const items = screen.getAllByRole('menuitem').filter((item) => !item.hasAttribute('disabled'))
    expect(items[0]).toHaveFocus()
    expect(menu).toBeInTheDocument()

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(probe.state().byId['s1']?.stage).toBe('interview')
    })
  })

  it('메뉴에서 Escape 를 누르면 트리거로 포커스가 돌아온다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류일').focus()
    await user.keyboard('m')
    await screen.findByRole('menu', { name: '서류일 이동할 단계' })

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '서류일 단계 이동' })).toHaveFocus()
  })
})

describe('스크린리더 안내', () => {
  it('live region은 처음부터 DOM에 있다 (메시지와 함께 마운트하면 낭독되지 않는다)', async () => {
    const { container } = await setup()
    expect(container.parentElement?.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
    expect(container.parentElement?.querySelectorAll('[aria-live="assertive"]')).toHaveLength(1)
  })

  it('이동이 확정되면 polite 영역에 안내가 들어간다', async () => {
    const user = userEvent.setup()
    await setup()

    cardButton('서류일').focus()
    await user.keyboard('m{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/서류일 님을 면접 단계로 이동했습니다/)).toHaveAttribute(
        'aria-live',
        'polite',
      )
    })
  })
})

describe('컬럼 접근성 이름', () => {
  it('단계명과 건수를 함께 노출한다', async () => {
    await setup()
    expect(screen.getByRole('region', { name: '서류검토 3명' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '처우협의 0명' })).toBeInTheDocument()
  })
})
