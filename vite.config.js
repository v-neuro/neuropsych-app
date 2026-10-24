import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineApp } from './pwa/vite-plugin.js'
import { productionSecurity } from './pwa/build-security.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), productionSecurity(), offlineApp()],
  // Preserve Vite 7's transform targets instead of raising browser requirements.
  build: { target: ['chrome107', 'edge107', 'firefox104', 'safari16'] },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
