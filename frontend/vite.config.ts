import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// In development the API runs separately (uvicorn on :8000); these paths are proxied to it.
// In production FastAPI serves this built site, so the same relative paths just work.
const API = process.env.VITE_DEV_API ?? 'http://127.0.0.1:8000'
const apiPaths = ['/health', '/docs', '/openapi.json', ...Array.from({ length: 10 }, (_, i) => `/agent${i + 1}`)]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(apiPaths.map((p) => [`^${p}$`, { target: API, changeOrigin: true }])),
  },
  build: { chunkSizeWarningLimit: 900 },
})
