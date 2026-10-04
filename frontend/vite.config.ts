import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // plotly is ~4.6mb no matter what, its lazy loaded on the chart pages
  build: { chunkSizeWarningLimit: 5000 },
  // npm run dev -> api calls go to the fastapi server
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
