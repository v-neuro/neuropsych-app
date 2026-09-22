import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { SingleTabGuard } from './components/single-tab-guard.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SingleTabGuard>
      <App />
    </SingleTabGuard>
  </React.StrictMode>,
)
