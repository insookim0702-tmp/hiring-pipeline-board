import { useEffect } from 'react'
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
import { ApplicantDetailPanel } from '../features/detail/ApplicantDetailPanel'
import { SelectionProvider, useSelectedId } from '../features/selection/SelectionProvider'
import { AnnouncerProvider } from '../features/feedback/AnnouncerProvider'
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
/**
 * `App.tsx`의 `AppShell`과 같은 구조. 패널을 여기서도 렌더해야
 * "Enter로 상세 열기 / 닫으면 포커스 복귀"를 검증할 수 있다.
 * (처음에 Board만 렌더했더니 dialog를 못 찾아 테스트가 실패했다)
 */
function BoardWithPanel() {
  const selectedId = useSelectedId()
  return (
    <div className="flex">
      <div inert={selectedId !== null}>
        <Board />
      </div>
      {selectedId !== null && <ApplicantDetailPanel key={selectedId} applicantId={selectedId} />}
    </div>
  )
}

export function renderBoard(): Harness {
  /**
   * 테스트가 상태와 액션에 닿는 창구.
   *
   * 처음엔 `Capture` 컴포넌트가 렌더 중에 바깥 변수에 대입했는데
   * React Compiler 린트가 두 번 막았다 (`Cannot reassign variables declared outside`,
   * 그다음 `react-hooks/immutability`). 규칙을 끄는 대신 **effect로 옮겼다** —
   * 렌더는 순수하게 두고, 커밋 이후에만 값을 내보낸다.
   * 테스트의 단정은 어차피 effect 플러시 뒤에 실행되므로 동작에 차이가 없다.
   */
  const sink: {
    state: ApplicantsState | null
    actions: ReturnType<typeof useApplicantsActions> | null
  } = { state: null, actions: null }

  function Capture({ onSnapshot }: { onSnapshot: typeof publish }) {
    const state = useApplicantsState()
    const actions = useApplicantsActions()
    useEffect(() => {
      onSnapshot(state, actions)
    }, [state, actions, onSnapshot])
    return null
  }

  const result = render(
    <AnnouncerProvider>
      <ToastProvider>
        <ApplicantsProvider>
          <FiltersProvider>
            <SelectionProvider>
              <Capture onSnapshot={publish} />
              <BoardWithPanel />
            </SelectionProvider>
          </FiltersProvider>
          <ToastViewport />
        </ApplicantsProvider>
      </ToastProvider>
    </AnnouncerProvider>,
  )

  const probe: Probe = {
    state: () => {
      if (sink.state === null) throw new Error('아직 렌더되지 않았다.')
      return sink.state
    },
    moveStage: (id, toStage) => {
      sink.actions?.moveStage(id, toStage)
    },
    reload: () => {
      sink.actions?.reload()
    },
  }

  function publish(state: ApplicantsState, actions: ReturnType<typeof useApplicantsActions>) {
    sink.state = state
    sink.actions = actions
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
