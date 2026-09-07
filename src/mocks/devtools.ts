import { getApplicant, moveApplicantStage } from './api'
import { configureMock, getMockConfig, resetMockConfig } from './config'
import { resetStore } from './store'

/**
 * 개발 모드에서 mock 서버를 콘솔로 조작할 수 있게 노출한다.
 *
 * 왜 필요한가: `?fail=1`은 **초기 로드까지** 실패시켜 버린다.
 * 그런데 "목록은 정상 로드 + 이동만 실패"를 만들어야 낙관적 롤백을 확인할 수 있다.
 * URL 파라미터로는 그 조합을 만들 수 없어서 런타임 제어 창구를 하나 둔다.
 *
 * 사용:
 *   __mockApi.configureMock({ failureRate: 1 })  // 이제부터 모든 요청 실패
 *   __mockApi.configureMock({ failureRate: 0 })  // 정상으로 복귀
 *   __mockApi.getMockConfig()
 *
 * 프로덕션 빌드에서는 호출되지 않으므로 번들에 남지 않는다.
 */
export function exposeMockDevtools(): void {
  Object.defineProperty(window, '__mockApi', {
    value: {
      configureMock,
      getMockConfig,
      resetMockConfig,
      resetStore,
      // UI를 거치지 않고 서버 상태만 바꿔 version 충돌(409)을 만들 때 쓴다.
      moveApplicantStage,
      getApplicant,
    },
    configurable: true,
  })
}
