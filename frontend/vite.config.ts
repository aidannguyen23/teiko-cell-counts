import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: { chunkSizeWarningLimit: 600 },
  // npm run dev -> api calls go to the fastapi server
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
