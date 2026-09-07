import type { Applicant } from '../domain/applicant'
import { getMockConfig } from './config'
import { generateApplicants } from './seed'

/**
 * mock 서버의 저장소.
 *
 * localStorage에 영속화해서 새로고침 후에도 단계 이동 결과가 유지되게 한다.
 * 다만 요청마다 JSON을 파싱하면 1,000건에서 낭비이므로, 모듈 메모리에 한 번 올려두고
 * 쓰기가 일어날 때만 직렬화해서 저장한다. (= "서버"의 메모리 + 디스크)
 */

/** 스키마가 바뀌면 이 숫자를 올린다. 옛 데이터가 남아 런타임에서 터지는 걸 막는다. */
const SCHEMA_VERSION = 1
const DATA_KEY = `hpb.applicants.v${SCHEMA_VERSION}`
const META_KEY = `hpb.meta.v${SCHEMA_VERSION}`

interface StoreMeta {
  seed: number
  count: number
}

let db: Applicant[] | null = null

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    // 사파리 프라이빗 모드 등에서 접근 자체가 throw 하는 경우가 있다.
    window.localStorage.getItem('__probe__')
    return window.localStorage
  } catch {
    return null
  }
}

function readPersisted(): Applicant[] | null {
  const storage = safeLocalStorage()
  if (!storage) return null

  const { seed, count } = getMockConfig()

  try {
    const rawMeta = storage.getItem(META_KEY)
    const rawData = storage.getItem(DATA_KEY)
    if (rawMeta === null || rawData === null) return null

    const meta = JSON.parse(rawMeta) as StoreMeta
    // seed나 count가 바뀌면(예: ?count=1000) 기존 데이터를 버리고 다시 시드한다.
    if (meta.seed !== seed || meta.count !== count) return null

    const data = JSON.parse(rawData) as unknown
    if (!Array.isArray(data) || data.length !== count) return null
    return data as Applicant[]
  } catch {
    // 손상된 JSON이면 조용히 버리고 재시드한다. 여기서 throw하면 앱이 영구히 못 뜬다.
    return null
  }
}

function persist(list: Applicant[]): void {
  const storage = safeLocalStorage()
  if (!storage) return
  const { seed, count } = getMockConfig()
  try {
    storage.setItem(DATA_KEY, JSON.stringify(list))
    storage.setItem(META_KEY, JSON.stringify({ seed, count } satisfies StoreMeta))
  } catch {
    // 용량 초과 등. 영속화 실패가 기능 자체를 막지는 않게 한다.
  }
}

function load(): Applicant[] {
  if (db !== null) return db
  const persisted = readPersisted()
  if (persisted !== null) {
    db = persisted
    return db
  }
  const { seed, count } = getMockConfig()
  db = generateApplicants(seed, count)
  persist(db)
  return db
}

/** 저장소 전체를 읽는다. 호출부가 변형하지 못하도록 복사해서 넘긴다. */
export function readAll(): Applicant[] {
  return load().map((a) => ({ ...a }))
}

export function readOne(id: string): Applicant | undefined {
  const found = load().find((a) => a.id === id)
  return found === undefined ? undefined : { ...found }
}

/**
 * 한 건을 교체한다. 저장소 안에는 항상 새 객체를 넣어
 * 밖으로 나간 참조가 저장소 내용을 바꿀 수 없게 한다.
 */
export function writeOne(next: Applicant): Applicant {
  const list = load()
  const index = list.findIndex((a) => a.id === next.id)
  if (index === -1) throw new Error(`writeOne: 존재하지 않는 id ${next.id}`)
  const stored = { ...next }
  list[index] = stored
  persist(list)
  return { ...stored }
}

/** 테스트에서 저장소를 초기 상태로 되돌린다. */
export function resetStore(): void {
  db = null
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(DATA_KEY)
    storage.removeItem(META_KEY)
  } catch {
    // 무시
  }
}
