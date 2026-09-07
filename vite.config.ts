import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// /api/ice/* -> Node ice proxy (:3001, NOAA OISST)
// /api/*     -> Python FastAPI backend (:8000, SIH simulation)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/ice': 'http://localhost:3001',
      '/api': 'http://localhost:8000',
    },
  },
})
