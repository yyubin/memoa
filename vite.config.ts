import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// FSRS 최적화기(WASM 스레드)는 SharedArrayBuffer 가 필요 → 페이지가 cross-origin isolated 여야 함.
// 배포(Cloudflare Pages)에서는 public/_headers 가 같은 헤더를 붙인다.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@open-spaced-repetition/binding', '@open-spaced-repetition/binding-wasm32-wasi'],
  },
})
