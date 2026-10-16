import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineApp } from './pwa/vite-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineApp()],
})
