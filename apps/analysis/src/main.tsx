import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme.css'
import './unified.css'
import './v2.css'
import './v3.css'
import App from './guided/GuideApp.tsx'
import { installSvgTextFloor } from './lib/svgTextFloor'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

installSvgTextFloor()
