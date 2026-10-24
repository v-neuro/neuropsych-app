import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineApp } from './pwa/vite-plugin.js'
import { productionSecurity } from './pwa/build-security.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), productionSecurity(), offlineApp()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
