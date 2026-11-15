import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the static build works under a GitHub Pages sub-path
export default defineConfig({
  base: './',
  cacheDir: './.vite-v10',
  plugins: [react()],
  // coordinate search: scripts/server.py on :8000 (patches are written into public/data/patches)
  server: { proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'node' },
} as never)
