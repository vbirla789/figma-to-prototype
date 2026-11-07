import { Route, Routes } from 'react-router-dom'
import { config } from './config'
import PhoneFrame from './shell/PhoneFrame'
import Home from './screens/Home'

/**
 * One route per Figma screen. Name routes after the Figma frame names so the
 * mapping stays obvious (frame "Cart / Empty" → /cart-empty).
 */
function Screens() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

export default function App() {
  return config.mode === 'app' ? (
    <PhoneFrame>
      <Screens />
    </PhoneFrame>
  ) : (
    <Screens />
  )
}
