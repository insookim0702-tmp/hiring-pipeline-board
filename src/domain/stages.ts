import type { Stage } from './applicant'
import { STAGES } from './applicant'

/**
 * 단계별 표시 정보. 라벨·색은 여기 한 곳에서만 정의한다.
 * 컬럼 헤더, 카드 배지, 상세 패널, 스크린리더 안내가 모두 이 값을 쓴다.
 */
export interface StageMeta {
  label: string
  /** 카드/헤더 배지 */
  badgeClass: string
  /** 컬럼 헤더 상단 강조선 */
  accentClass: string
}

export const STAGE_META: Record<Stage, StageMeta> = {
  screening: {
    label: '서류검토',
    badgeClass: 'bg-slate-100 text-slate-700 ring-slate-200',
    accentClass: 'bg-slate-400',
  },
  interview: {
    label: '면접',
    badgeClass: 'bg-sky-100 text-sky-800 ring-sky-200',
    accentClass: 'bg-sky-500',
  },
  offer: {
    label: '처우협의',
    badgeClass: 'bg-amber-100 text-amber-800 ring-amber-200',
    accentClass: 'bg-amber-500',
  },
  hired: {
    label: '최종합격',
    badgeClass: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    accentClass: 'bg-emerald-500',
  },
  rejected: {
    label: '불합격',
    badgeClass: 'bg-rose-100 text-rose-800 ring-rose-200',
    accentClass: 'bg-rose-400',
  },
}

export function stageLabel(stage: Stage): string {
  return STAGE_META[stage].label
}

/** 컬럼 렌더 순서. `STAGES`의 선언 순서가 곧 파이프라인 순서다. */
export const STAGE_ORDER: readonly Stage[] = STAGES
