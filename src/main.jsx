import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Fontes self-hosted (empacotadas pelo Vite -> mesma origem, compativel com CSP e PWA offline)
import '@fontsource-variable/fraunces'
import '@fontsource-variable/archivo'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
