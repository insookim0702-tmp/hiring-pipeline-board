import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 커밋 0~6 시점에는 테스트가 없다. 테스트 0개를 실패로 취급하면
    // 세팅 단계에서 `npm run test`가 exit 1로 죽는다.
    passWithNoTests: true,
  },
})
