/**
 * 시드 고정 PRNG (mulberry32).
 *
 * 시드 데이터 생성에 `Math.random`을 쓰면 새로고침마다 다른 사람이 나와서
 * "새로고침 후에도 이동이 유지되는가"를 눈으로 확인할 수 없다.
 * 그래서 데이터 생성은 이 함수로, 지연·실패 판정은 별도의 주입 가능한 난수로 분리했다.
 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 배열에서 하나 고른다. `noUncheckedIndexedAccess` 때문에 단정이 필요하다. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: 빈 배열')
  return items[Math.floor(rng() * items.length)]!
}

/** [min, max] 정수 */
export function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}
