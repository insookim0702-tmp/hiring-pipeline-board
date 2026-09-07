import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  /** 있으면 제목 아래에 렌더된다. 필터 초기화 버튼 같은 것. */
  action?: ReactNode
  size?: 'sm' | 'md'
}

/**
 * 빈 상태 공통 표현.
 *
 * 빈 상태는 하나가 아니라 셋이다 —
 * ① 데이터 자체가 0건 ② 특정 컬럼이 0건 ③ 필터 결과가 0건.
 * 셋의 문구와 행동이 다르므로 컴포넌트를 셋으로 나누는 대신
 * 표현만 공통화하고 문구·액션을 호출부가 정하게 했다.
 */
export function EmptyState({ title, description, action, size = 'md' }: EmptyStateProps) {
  return (
    <div
      className={
        size === 'sm'
          ? 'flex flex-col items-center gap-1 px-3 py-6 text-center'
          : 'flex flex-col items-center gap-2 px-6 py-16 text-center'
      }
    >
      <p
        className={size === 'sm' ? 'text-xs text-slate-500' : 'text-sm font-medium text-slate-700'}
      >
        {title}
      </p>
      {description !== undefined && <p className="text-xs text-slate-500">{description}</p>}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
