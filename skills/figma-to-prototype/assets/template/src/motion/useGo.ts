import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, type To } from 'react-router-dom'

export type TransitionType = 'push' | 'pop' | 'up' | 'down' | 'fade' | 'none'

/**
 * Navigate with a screen transition.
 *   const go = useGo()
 *   go('/product/1')                 // push
 *   go(-1, 'pop')                    // back
 *   go('/filters', 'up')             // full-screen modal
 * Map each Figma prototype connection to one of these (see references/interactions.md).
 */
export function useGo() {
  const navigate = useNavigate()
  return useCallback(
    (to: To | number, type: TransitionType = 'push') => {
      const run = () =>
        flushSync(() => {
          if (typeof to === 'number') navigate(to)
          else navigate(to)
        })
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }
      if (type === 'none' || !doc.startViewTransition) return run()
      document.documentElement.dataset.vt = type
      const t = doc.startViewTransition(run)
      t.finished.finally(() => {
        if (document.documentElement.dataset.vt === type) delete document.documentElement.dataset.vt
      })
    },
    [navigate],
  )
}
