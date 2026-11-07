import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { config } from './config'
import { installMotionTokens } from './motion/motion'
import App from './App'
import './styles/base.css'
import './styles/tokens.css'
import './motion/transitions.css'

// ?capture (full frame incl. mock status bar) or ?capture=screen (content only)
// renders the app at exactly the viewport size with no mockup chrome, so
// tools/compare.mjs can diff it pixel-for-pixel against the Figma export.
const capture = new URLSearchParams(location.search).get('capture')
if (capture !== null) document.documentElement.dataset.capture = capture || 'full'
document.documentElement.dataset.mode = config.mode
installMotionTokens()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
