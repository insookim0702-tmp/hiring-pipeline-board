import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

if (import.meta.env.DEV) {
  // 개발 모드에서만 mock 서버 제어를 콘솔에 노출한다. (낙관적 롤백 수동 확인용)
  const { exposeMockDevtools } = await import('./mocks/devtools')
  exposeMockDevtools()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
