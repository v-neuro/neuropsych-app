import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { SingleTabGuard } from './components/single-tab-guard.jsx'
import './index.css'
import { registerPwa } from './lib/pwa'

// Keep Vite development/HMR free of service-worker caching.
if (import.meta.env.PROD) void registerPwa()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SingleTabGuard>
      <App />
    </SingleTabGuard>
  </React.StrictMode>,
)
