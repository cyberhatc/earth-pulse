import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // during `npm run dev`, calls to /api/* are forwarded to the local FastAPI
      '/api': { target: 'http://localhost:8000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
