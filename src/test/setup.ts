import '@testing-library/jest-dom/vitest'

/**
 * jsdom에는 레이아웃 엔진이 없다. 모든 요소의 크기가 0이고 `ResizeObserver`도 없다.
 *
 * 가상 스크롤(@tanstack/react-virtual)은 **컨테이너 높이와 항목 높이를 측정해서**
 * 무엇을 렌더할지 정하므로, 그대로 두면 카드가 한 장도 렌더되지 않는다.
 * 실제로 커밋 13에서 보드 테스트 20여 개가 한꺼번에 깨졌고, 원인이 이것이었다.
 *
 * 그래서 **테스트 환경에만** 최소한의 레이아웃을 흉내낸다.
 * - `data-card-id`가 있는 요소(카드) → 카드 한 장 높이
 * - 나머지(스크롤 컨테이너 포함) → 컬럼 높이
 *
 * 프로덕션 코드에 테스트용 분기를 넣지 않기 위한 선택이다.
 */
const CARD_HEIGHT = 84
const CONTAINER_HEIGHT = 600
const WIDTH = 300

/**
 * 크기 변화를 감시하는 척만 하는 스텁으로는 부족했다.
 * 가상 스크롤은 `ResizeObserver` 콜백이 **한 번은 불려야** 컨테이너 높이를 알게 된다.
 * 처음엔 빈 메서드만 두었더니 높이를 계속 0으로 알아 카드가 0장 렌더됐다.
 * 그래서 `observe()` 시점에 즉시 콜백을 호출한다.
 */
class ResizeObserverStub implements ResizeObserver {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element): void {
    // borderBoxSize를 주지 않으면 라이브러리가 getBoundingClientRect로 되돌아간다.
    this.callback([{ target } as ResizeObserverEntry], this)
  }

  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub
}

/**
 * 가상 스크롤이 컨테이너 크기를 재는 경로는 `getBoundingClientRect`가 아니라
 * **`offsetWidth` / `offsetHeight`** 였다(@tanstack/virtual-core의 `getRect`).
 * 라이브러리 소스를 열어 확인하기 전까지는 rect만 흉내내고 있어서 계속 0장이 렌더됐다.
 */
function fakeSize(element: HTMLElement): number {
  return element.hasAttribute('data-card-id') ? CARD_HEIGHT : CONTAINER_HEIGHT
}

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement): number {
    return fakeSize(this)
  },
})

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get(): number {
    return WIDTH
  },
})

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value(this: HTMLElement): DOMRect {
    const height = fakeSize(this)
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: WIDTH,
      bottom: height,
      width: WIDTH,
      height,
      toJSON: () => ({}),
    } as DOMRect
  },
})

/**
 * jsdom의 `scrollTop`은 항상 0이고 `scrollTo`는 없다.
 *
 * 그냥 빈 함수로 두면 "화면 밖 카드로 방향키 이동" 같은 **가상 스크롤 회귀를
 * 검증할 수 없다** — 스크롤이 일어나지 않으니 대상 카드가 영영 렌더되지 않는다.
 * 그래서 스크롤 위치를 실제로 저장하고 `scroll` 이벤트까지 발생시킨다.
 */
const scrollOffsets = new WeakMap<Element, number>()

Object.defineProperty(Element.prototype, 'scrollTop', {
  configurable: true,
  get(this: Element): number {
    return scrollOffsets.get(this) ?? 0
  },
  set(this: Element, value: number) {
    scrollOffsets.set(this, value)
    this.dispatchEvent(new Event('scroll'))
  },
})

/**
 * 가상 스크롤이 "얼마나 스크롤할 수 있는가"를 계산할 때 쓰는 값들.
 * `getMaxScrollOffset()`이 `scrollHeight - clientHeight`를 쓰는데 jsdom에서는
 * 둘 다 0이라 **모든 스크롤 목표가 0으로 잘렸다.** 실제로 `scrollTo({top: 0})`만
 * 호출되는 걸 보고 라이브러리 소스를 따라가 찾은 원인이다.
 */
Object.defineProperty(Element.prototype, 'clientHeight', {
  configurable: true,
  get(this: Element): number {
    return fakeSize(this as HTMLElement)
  },
})

Object.defineProperty(Element.prototype, 'scrollHeight', {
  configurable: true,
  get(this: Element): number {
    // 가상 목록은 전체 높이를 자식의 inline style로 표현한다. 그게 콘텐츠 높이다.
    const child = this.firstElementChild
    const declared = child instanceof HTMLElement ? child.style.height : ''
    const parsed = Number.parseFloat(declared)
    return Number.isFinite(parsed) ? parsed : fakeSize(this as HTMLElement)
  },
})

Element.prototype.scrollTo = function scrollTo(
  this: Element,
  optionsOrX?: ScrollToOptions | number,
): void {
  if (typeof optionsOrX === 'object' && optionsOrX !== null && typeof optionsOrX.top === 'number') {
    this.scrollTop = optionsOrX.top
  }
} as typeof Element.prototype.scrollTo

// 가상 스크롤이 프레임 단위로 위치를 다시 잡을 때 쓴다.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => {
      callback(performance.now())
    }, 0) as unknown as number) as typeof globalThis.requestAnimationFrame
}
