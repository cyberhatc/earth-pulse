import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  // during `npm run dev` / `npm run preview`, calls to /api/* are forwarded to the local FastAPI
  '/api': { target: 'http://localhost:8000', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/api/, '') },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  build: { outDir: 'dist', sourcemap: false },
})
