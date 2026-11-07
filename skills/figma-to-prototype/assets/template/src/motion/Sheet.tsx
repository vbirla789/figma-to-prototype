import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PHONE_OVERLAY_ID } from '../shell/PhoneFrame'
import { MOTION, springTo } from './motion'
import './Sheet.css'

/**
 * Bottom sheet: rises on the move spring, scrim fades, drag the sheet down to
 * dismiss (distance or flick), tap the scrim to close. Renders into the phone
 * overlay so it stays inside the mockup on a laptop.
 *
 *   <Sheet open={open} onClose={() => setOpen(false)}>…Figma sheet content…</Sheet>
 */
export default function Sheet({
  open,
  onClose,
  children,
  className = '',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const [mounted, setMounted] = useState(open)
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y0: number; t0: number; last: number; lastT: number; v: number } | null>(null)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  // enter / exit
  useLayoutEffect(() => {
    const el = panel.current
    const sc = scrim.current
    if (!el || !sc) return
    if (open) {
      el.style.transform = `translateY(${el.offsetHeight}px)`
      sc.style.opacity = '0'
      void el.offsetHeight
      sc.style.transition = `opacity ${MOTION.ms.scrim}ms ${MOTION.ease.out}`
      sc.style.opacity = '1'
      springTo(el, { y: 0 })
    } else if (mounted) {
      sc.style.transition = `opacity ${MOTION.ms.fadeOut}ms ${MOTION.ease.in}`
      sc.style.opacity = '0'
      springTo(el, { y: el.offsetHeight }, { v0: drag.current?.v ?? 0 }).then(() => {
        drag.current = null
        setMounted(false)
      })
    }
  }, [open, mounted])

  if (!mounted) return null
  const host = document.getElementById(PHONE_OVERLAY_ID) ?? document.body

  const onPointerDown = (e: React.PointerEvent) => {
    // let buttons/inputs inside the sheet keep their clicks
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [data-no-drag]')) return
    // only start a dismiss-drag when the sheet's own scroll is at the top
    const scroller = (e.target as HTMLElement).closest('.sheet__body') as HTMLElement | null
    if (scroller && scroller.scrollTop > 0) return
    drag.current = { y0: e.clientY, t0: e.timeStamp, last: e.clientY, lastT: e.timeStamp, v: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    const dt = Math.max(1, e.timeStamp - d.lastT)
    d.v = ((e.clientY - d.last) / dt) * 1000
    d.last = e.clientY
    d.lastT = e.timeStamp
    const dy = e.clientY - d.y0
    // rubber-band upward, follow the finger downward
    const y = dy < 0 ? -Math.sqrt(-dy) * 2 : dy
    el.getAnimations().forEach((a) => a.cancel())
    el.style.transform = `translateY(${y}px)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / el.offsetHeight))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    const el = panel.current
    if (!d || !el) return
    const dy = e.clientY - d.y0
    // dismiss past a quarter of the sheet (max 120px) or on a downward flick
    if (dy > Math.min(120, el.offsetHeight / 4) || d.v > 600) onClose()
    else {
      if (scrim.current) scrim.current.style.opacity = '1'
      springTo(el, { y: 0 }, { v0: -d.v })
      drag.current = null
    }
  }

  return createPortal(
    <div className="sheet-layer">
      <div ref={scrim} className="sheet__scrim" onClick={onClose} />
      <div
        ref={panel}
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet__grabber" />
        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    host,
  )
}
