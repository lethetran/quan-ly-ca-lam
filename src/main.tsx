import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Link cũ dạng /#/route (thời HashRouter) → chuyển sang URL sạch /route
// (chỉ trên host chính; GitHub Pages giữ hash nên không đụng)
if (!location.hostname.endsWith('.github.io') && location.hash.startsWith('#/')) {
  history.replaceState(null, '', location.hash.slice(1) || '/')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
