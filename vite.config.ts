import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward every request that isn't a static asset to the local backend.
      // This runs server-side, so CORS is never an issue.
      '/auth': { target: 'http://localhost:8000', changeOrigin: true },
      '/boards': { target: 'http://localhost:8000', changeOrigin: true },
      '/users': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
