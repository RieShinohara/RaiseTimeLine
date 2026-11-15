import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 5173番が使えないときに、黙って別の番号で起動しない（失敗させる）
    port: 5173,
    strictPort: true,
    // 画面から /api にお願いすると、バックエンド（8080番）に中継する。
    // ブラウザには「同じ場所との通信」に見えるので、CORS の設定が要らない
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    // カバレッジ（npm run test:coverage）：テストが、コードのどこまでを通ったか。
    // しきい値は、画面が増えてきたら、測った数字をもとに決める（今は、測るだけ）
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // テスト自身と、テスト用の道具、アプリを起動する入口（main.tsx）は、測らない
      exclude: ['src/**/*.test.*', 'src/test-setup.ts', 'src/test-utils/**', 'src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
})
