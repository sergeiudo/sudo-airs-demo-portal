import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'
// New design layer — inert unless html.ui-new is set (Design switch). Must load
// after globals.css so its rules win ties with the classic light layer.
import './styles/ui-new.css'
import './styles/ui-new.generated.css'

// Default to light mode on load
document.documentElement.classList.add('light')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
