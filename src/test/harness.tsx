import { render, type RenderResult } from '@testing-library/react'
import type { Applicant, Stage } from '../domain/applicant'
import { Board } from '../features/board/Board'
import {
  ApplicantsProvider,
  useApplicantsActions,
  useApplicantsState,
} from '../features/applicants/ApplicantsProvider'
import type { ApplicantsState } from '../features/applicants/types'
import { FiltersProvider } from '../features/filters/FiltersProvider'
import { SelectionProvider } from '../features/selection/SelectionProvider'
import { ToastProvider } from '../features/feedback/ToastProvider'
import { ToastViewport } from '../features/feedback/ToastViewport'

export function makeApplicant(overrides: Partial<Applicant> = {}): Applicant {
  const stage: Stage = overrides.stage ?? 'screening'
  return {
    id: 'a1',
    name: '홍길동',
    position: '프론트엔드 개발',
    appliedAt: '2026-08-01T00:00:00.000Z',
    stage,
    version: 1,
    email: 'a1@example.com',
    phone: '010-1111-2222',
    experienceYears: 3,
    resumeSummary: '요약',
    memo: '',
    stageHistory: [{ at: '2026-08-01T00:00:00.000Z', from: null, to: stage }],
    ...overrides,
  }
}

/** 테스트가 상태와 액션에 직접 닿을 수 있게 하는 창구. */
export interface Probe {
  state: () => ApplicantsState
  moveStage: (id: string, toStage: Stage) => void
  reload: () => void
}

export interface Harness extends RenderResult {
  probe: Probe
}

/**
 * 보드 + 스토어 + 토스트를 실제로 렌더한다.
 *
 * 이동을 메뉴 클릭이 아니라 액션 호출로 일으키는 이유: "같은 카드를 빠르게 연속 이동"
 * 같은 케이스는 UI가 pending 중 메뉴를 잠그기 때문에 클릭으로는 재현되지 않는다.
 * UI 잠금은 완화책이지 경쟁 상태의 해결이 아니므로, 잠금을 우회해서 store 로직 자체를
 * 검증해야 한다.
 */
export function renderBoard(): Harness {
  let latestState: ApplicantsState | null = null
  let latestActions: ReturnType<typeof useApplicantsActions> | null = null

  function Capture() {
    latestState = useApplicantsState()
    latestActions = useApplicantsActions()
    return null
  }

  const result = render(
    <ToastProvider>
      <ApplicantsProvider>
        <FiltersProvider>
          <SelectionProvider>
            <Capture />
            <Board />
          </SelectionProvider>
        </FiltersProvider>
        <ToastViewport />
      </ApplicantsProvider>
    </ToastProvider>,
  )

  const probe: Probe = {
    state: () => {
      if (latestState === null) throw new Error('아직 렌더되지 않았다.')
      return latestState
    },
    moveStage: (id, toStage) => {
      latestActions?.moveStage(id, toStage)
    },
    reload: () => {
      latestActions?.reload()
    },
  }

  return { ...result, probe }
}

/** 화면에서 그 카드가 실제로 어느 컬럼에 있는지 읽는다. */
export function columnOf(container: HTMLElement, name: string): string | null {
  const cards = Array.from(container.querySelectorAll('li'))
  const card = cards.find((li) => li.textContent?.startsWith(name) === true)
  const section = card?.closest('section')
  return section?.getAttribute('aria-label') ?? null
}
