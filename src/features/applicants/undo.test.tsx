import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Applicant, Stage } from '../../domain/applicant'
import { columnOf, makeApplicant, renderBoard } from '../../test/harness'

import * as mocksModule from '../../mocks'

vi.mock('../../mocks', async (importOriginal) => {
  const actual = await importOriginal<typeof mocksModule>()
  return { ...actual, listApplicants: vi.fn(), moveApplicantStage: vi.fn() }
})

const { listApplicants, moveApplicantStage, NetworkError } = mocksModule

interface Deferred {
  input: { id: string; toStage: Stage; expectedVersion: number }
  resolve: (applicant: Applicant) => void
  reject: (error: unknown) => void
}

let moveCalls: Deferred[] = []

beforeEach(() => {
  moveCalls = []
  vi.mocked(moveApplicantStage).mockImplementation(
    (input) =>
      new Promise<Applicant>((resolve, reject) => {
        moveCalls.push({ input, resolve, reject })
      }),
  )
})

afterEach(() => {
  vi.clearAllMocks()
})

async function setup(applicants: Applicant[]) {
  vi.mocked(listApplicants).mockResolvedValue(applicants)
  const harness = renderBoard()
  await waitFor(() => {
    expect(harness.probe.state().status).toBe('ready')
  })
  return harness
}

/** 이동 한 건을 성공까지 진행시킨다. */
async function moveAndConfirm(
  probe: ReturnType<typeof renderBoard>['probe'],
  id: string,
  toStage: Stage,
  nextVersion: number,
  name = '홍길동',
) {
  act(() => {
    probe.moveStage(id, toStage)
  })
  const call = moveCalls[moveCalls.length - 1]
  await act(async () => {
    call?.resolve(makeApplicant({ id, name, stage: toStage, version: nextVersion }))
  })
}

describe('되돌리기', () => {
  it('직전 이동을 되돌리면 원래 단계로 돌아간다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    expect(columnOf(container, '홍길동')).toBe('면접 1명')

    act(() => {
      probe.undo()
    })
    // 낙관적으로 즉시 되돌아간다
    expect(columnOf(container, '홍길동')).toBe('서류검토 1명')

    const undoCall = moveCalls[moveCalls.length - 1]
    expect(undoCall?.input).toMatchObject({ toStage: 'screening', expectedVersion: 2 })

    await act(async () => {
      undoCall?.resolve(makeApplicant({ stage: 'screening', version: 3 }))
    })

    expect(probe.state().byId['a1']?.stage).toBe('screening')
  })

  it('되돌리기는 진짜 API 호출이다 (로컬만 되돌리면 새로고침 시 되살아난다)', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'hired', 2)
    const before = moveCalls.length

    act(() => {
      probe.undo()
    })

    expect(moveCalls).toHaveLength(before + 1)
    expect(moveCalls[before]?.input.toStage).toBe('screening')
  })

  it('되돌리기가 실패하면 이동 후 상태로 복귀하고 알린다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)

    act(() => {
      probe.undo()
    })
    expect(columnOf(container, '홍길동')).toBe('서류검토 1명')

    await act(async () => {
      moveCalls[moveCalls.length - 1]?.reject(new NetworkError())
    })

    // 되돌리기 이전(= 이동이 성공한 뒤) 상태로 돌아가야 한다
    expect(columnOf(container, '홍길동')).toBe('면접 1명')
    expect(probe.state().byId['a1']?.stage).toBe('interview')
  })

  it('되돌리기가 실패하면 다시 되돌릴 수 있다 (대상이 사라지지 않는다)', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    act(() => {
      probe.undo()
    })
    await act(async () => {
      moveCalls[moveCalls.length - 1]?.reject(new NetworkError())
    })

    expect(probe.state().lastMove).not.toBeNull()

    const before = moveCalls.length
    act(() => {
      probe.undo()
    })
    expect(moveCalls).toHaveLength(before + 1)
  })

  it('되돌리기를 되돌리지는 않는다 (핑퐁 방지)', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    act(() => {
      probe.undo()
    })
    await act(async () => {
      moveCalls[moveCalls.length - 1]?.resolve(makeApplicant({ stage: 'screening', version: 3 }))
    })

    expect(probe.state().lastMove).toBeNull()

    const before = moveCalls.length
    act(() => {
      probe.undo()
    })
    expect(moveCalls).toHaveLength(before)
  })

  it('연속 이동이 병합됐어도 "처음 시작한 단계"로 되돌아간다', async () => {
    const { probe, container } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    act(() => {
      probe.moveStage('a1', 'interview')
    })
    act(() => {
      probe.moveStage('a1', 'offer')
    })

    await act(async () => {
      moveCalls[0]?.resolve(makeApplicant({ stage: 'interview', version: 2 }))
    })
    await act(async () => {
      moveCalls[1]?.resolve(makeApplicant({ stage: 'offer', version: 3 }))
    })

    expect(probe.state().lastMove).toMatchObject({ from: 'screening', to: 'offer' })

    act(() => {
      probe.undo()
    })
    // 중간 단계(면접)가 아니라 시작 단계(서류검토)로
    expect(columnOf(container, '홍길동')).toBe('서류검토 1명')
  })

  it('이동이 진행 중이면 되돌리기를 받지 않고 이유를 알린다', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)

    // 새 이동을 시작해 pending 상태로 만든다
    act(() => {
      probe.moveStage('a1', 'offer')
    })
    const before = moveCalls.length

    act(() => {
      probe.undo()
    })

    expect(moveCalls).toHaveLength(before)
    expect(await screen.findByText('이동이 진행 중입니다')).toBeInTheDocument()
  })

  it('목록을 새로 불러오면 되돌리기 대상이 사라진다', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    expect(probe.state().lastMove).not.toBeNull()

    vi.mocked(listApplicants).mockResolvedValue([makeApplicant({ stage: 'interview', version: 2 })])
    await act(async () => {
      probe.reload()
    })

    expect(probe.state().lastMove).toBeNull()
  })
})

describe('성공 토스트의 되돌리기 버튼', () => {
  it('이동이 확정되면 되돌리기 버튼이 있는 토스트가 뜬다', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)

    const undoButton = await screen.findByRole('button', { name: '되돌리기' })
    const before = moveCalls.length

    await act(async () => {
      undoButton.click()
    })

    expect(moveCalls).toHaveLength(before + 1)
    expect(moveCalls[before]?.input.toStage).toBe('screening')
  })

  it('되돌리기로 생긴 이동에는 되돌리기 버튼을 붙이지 않는다', async () => {
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    await act(async () => {
      screen.getByRole('button', { name: '되돌리기' }).click()
    })
    await act(async () => {
      moveCalls[moveCalls.length - 1]?.resolve(makeApplicant({ stage: 'screening', version: 3 }))
    })

    expect(screen.queryByRole('button', { name: '되돌리기' })).not.toBeInTheDocument()
  })
})

describe('Ctrl+Z 단축키', () => {
  it('보드에서 Ctrl+Z 는 되돌리기를 실행한다', async () => {
    const user = userEvent.setup()
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    const before = moveCalls.length

    await user.keyboard('{Control>}z{/Control}')

    expect(moveCalls).toHaveLength(before + 1)
    expect(moveCalls[before]?.input.toStage).toBe('screening')
  })

  it('검색 입력창에 포커스가 있으면 가로채지 않는다', async () => {
    const user = userEvent.setup()
    const { probe } = await setup([makeApplicant({ stage: 'screening', version: 1 })])

    await moveAndConfirm(probe, 'a1', 'interview', 2)
    const before = moveCalls.length

    const search = screen.getByRole('searchbox', { name: '이름 검색' })
    search.focus()
    await user.keyboard('{Control>}z{/Control}')

    expect(moveCalls).toHaveLength(before)
  })
})
