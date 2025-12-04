import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Crucial: Exposes the server to your local network/phone
  },
  build: {
    outDir: 'dist',
  },
  define: {
    'process.env': {} // Polyfill to prevent errors with legacy libraries
  }
})