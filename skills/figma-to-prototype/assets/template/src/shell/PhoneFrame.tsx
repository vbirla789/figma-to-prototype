import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { config } from '../config'
import './PhoneFrame.css'

/**
 * Phone shell for app prototypes.
 *
 * Laptop/desktop: the screens sit in a phone-sized frame (the Figma frame size)
 * with a mock status bar and home indicator, centred on a neutral stage.
 * Real phone (narrow, or a short touch screen in landscape): the mockup chrome
 * disappears — no fake status bar, no home indicator, no rounded frame, no
 * stage padding — and the app fills the browser, clear of the notch and home
 * bar via safe-area insets.
 *
 * Screens never draw their own status bar or home indicator, even when the
 * Figma frame contains those layers; the shell owns them.
 */

export const PHONE_OVERLAY_ID = 'phone-overlay'

type Chrome = { background: string; tone: 'dark' | 'light' }
const ChromeContext = createContext<(c: Chrome) => void>(() => {})

/**
 * Colour the status bar / home indicator areas for the current screen.
 * tone 'dark' = dark icons (for light backgrounds), 'light' = white icons.
 * On a real phone it also sets the browser's theme-color so Safari/Chrome
 * paint their own bars to match.
 */
export function useChrome(background: string, tone: Chrome['tone'] = 'dark') {
  const set = useContext(ChromeContext)
  useEffect(() => set({ background, tone }), [set, background, tone])
}

export default function PhoneFrame({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<Chrome>({ background: '#ffffff', tone: 'dark' })

  // iOS Safari only reliably re-reads theme-color when the tag is re-inserted.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.remove()
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = chrome.background
    document.head.appendChild(meta)
    document.documentElement.style.background = chrome.background
  }, [chrome.background])

  const style = {
    '--frame-w': `${config.frame.width}px`,
    '--frame-h': `${config.frame.height}px`,
    '--status-h': `${config.statusBar}px`,
    '--home-h': `${config.homeIndicator}px`,
    '--chrome-bg': chrome.background,
    '--chrome-fg': chrome.tone === 'dark' ? '#000000' : '#ffffff',
  } as React.CSSProperties

  return (
    <ChromeContext.Provider value={setChrome}>
      <div className="phone-stage" style={style}>
        <div className="phone-shell">
          <StatusBar />
          <div className="phone-viewport">
            {/* view-transition-name: screen — route transitions animate this box
                only, so the status bar and home indicator stay still */}
            <div className="phone-screen" id="phone-screen">
              {children}
            </div>
            {/* host for sheets, dialogs, toasts: a sibling of the scroller so they
                don't scroll away, and inside the frame so they stay in the mockup */}
            <div className="phone-overlay" id={PHONE_OVERLAY_ID} />
          </div>
          {config.homeIndicator > 0 && (
            <div className="phone-home">
              <span className="phone-home__bar" />
            </div>
          )}
        </div>
      </div>
    </ChromeContext.Provider>
  )
}

function StatusBar() {
  return (
    <div className="phone-status" aria-hidden>
      <span className="phone-status__time">9:41</span>
      <span className="phone-status__icons">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
          <rect x="0" y="7.5" width="3" height="4.5" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9.6a1.7 1.7 0 0 1 1.7 1.7c0 .2-.06.36-.18.47l-1.1 1.06a.6.6 0 0 1-.84 0l-1.1-1.06a.63.63 0 0 1-.18-.47A1.7 1.7 0 0 1 8 9.6Z" />
          <path d="M8 5.4c1.72 0 3.28.66 4.45 1.74a.62.62 0 0 1 .02.9l-.9.88a.6.6 0 0 1-.82.02A4.06 4.06 0 0 0 8 7.9c-1.05 0-2 .39-2.75 1.04a.6.6 0 0 1-.82-.02l-.9-.88a.62.62 0 0 1 .02-.9A6.55 6.55 0 0 1 8 5.4Z" />
          <path d="M8 1.2c2.87 0 5.48 1.1 7.44 2.9.25.24.26.64.02.88l-.9.89a.6.6 0 0 1-.83.01A8.9 8.9 0 0 0 8 3.7c-2.2 0-4.2.8-5.73 2.18a.6.6 0 0 1-.83-.01l-.9-.89a.62.62 0 0 1 .02-.88A11.02 11.02 0 0 1 8 1.2Z" />
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.35" />
          <rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor" />
          <path d="M23 4v4a2.2 2.2 0 0 0 0-4Z" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  )
}
