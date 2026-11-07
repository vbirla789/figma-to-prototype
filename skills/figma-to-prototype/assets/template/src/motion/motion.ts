/**
 * Motion tokens + helpers. No dependencies.
 *
 * The values below are a sensible default. If the designer or their team has a
 * motion standard (a tokens file, a motion skill, ProtoPie/Figma values), replace
 * MOTION with those numbers — every helper and the CSS variables read from here.
 *
 * Rules the defaults follow:
 *  - things that MOVE (position, size, scale) use a spring; things that FADE
 *    (opacity, colour, blur) use a curve. One element can have both, each on
 *    its own timing.
 *  - entering = ease-out (fast start, gentle landing); exits are quicker.
 *  - no visible bounce on task UI; overshoot is for celebrations only.
 */
export const MOTION = {
  spring: {
    move: { w: 17, z: 0.85 }, // screens, sheets, cards, chips — ~450ms, <1% overshoot
    gentle: { w: 13, z: 0.95 }, // large surfaces, morphs carrying text
    snappy: { w: 24, z: 1 }, // small controls, toggles
    pop: { w: 15, z: 0.55 }, // rewards only (like, badge, success)
  },
  ease: {
    out: 'cubic-bezier(0.23, 1, 0.32, 1)', // entering, fading in
    in: 'cubic-bezier(0.4, 0, 1, 1)', // leaving, fading out
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)', // on-screen state changes, colour swaps
    drawer: 'cubic-bezier(0.32, 0.72, 0, 1)', // iOS-like sheet when a spring isn't possible
  },
  ms: { fadeIn: 200, fadeOut: 150, reveal: 300, scrim: 300, press: 120, stagger: 40 },
  press: { control: 0.96, wide: 0.98, icon: 0.92 },
} as const

export type Spring = { w: number; z: number }

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Remaining offset (1 → 0) of a damped spring at time t seconds. */
export function springAt(t: number, { w, z }: Spring, x0 = 1, v0 = 0) {
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z)
    return Math.exp(-z * w * t) * (x0 * Math.cos(wd * t) + ((v0 + z * w * x0) / wd) * Math.sin(wd * t))
  }
  return Math.exp(-w * t) * (x0 + (v0 + w * x0) * t)
}

/** Seconds until the spring is within 0.1% of rest. */
export function springDuration(s: Spring) {
  for (let t = 0.05; t < 3; t += 0.01) {
    let settled = true
    for (let k = t; k < t + 0.3; k += 0.02) if (Math.abs(springAt(k, s)) > 0.001) settled = false
    if (settled) return t
  }
  return 3
}

/** A spring as a CSS linear() easing — use it with the duration from springDuration. */
export function springEasing(s: Spring, stops = 40) {
  const d = springDuration(s)
  const v: string[] = []
  for (let i = 0; i <= stops; i++) v.push(i === stops ? '1' : (1 - springAt((i / stops) * d, s)).toFixed(4))
  return `linear(${v.join(', ')})`
}

/**
 * Publish the tokens as CSS variables so CSS transitions use the same values:
 * transition: transform var(--spring-move-ms) var(--spring-move);
 */
export function installMotionTokens() {
  const root = document.documentElement.style
  for (const [name, s] of Object.entries(MOTION.spring)) {
    root.setProperty(`--spring-${name}`, springEasing(s))
    root.setProperty(`--spring-${name}-ms`, `${Math.round(springDuration(s) * 1000)}ms`)
  }
  for (const [name, e] of Object.entries(MOTION.ease)) root.setProperty(`--ease-${name}`, e)
  for (const [name, ms] of Object.entries(MOTION.ms)) root.setProperty(`--ms-${name}`, `${ms}ms`)
  for (const [name, s] of Object.entries(MOTION.press)) root.setProperty(`--press-${name}`, String(s))
}

/**
 * Animate an element's transform on a spring, starting from wherever it is now
 * (so it can be interrupted mid-flight and re-targeted without a jump).
 * v0 = release velocity in px/s along the travel, for gesture hand-offs.
 */
export function springTo(
  el: HTMLElement,
  to: { x?: number; y?: number; scale?: number },
  { spring = MOTION.spring.move, v0 = 0 }: { spring?: Spring; v0?: number } = {},
) {
  const m = new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform)
  el.getAnimations().forEach((a) => a.cancel())
  const from = { x: m.m41, y: m.m42, scale: m.a }
  const target = { x: to.x ?? from.x, y: to.y ?? from.y, scale: to.scale ?? from.scale }
  const end = `translate(${target.x}px, ${target.y}px) scale(${target.scale})`
  if (reducedMotion()) {
    el.style.transform = end
    return Promise.resolve()
  }
  const dist = Math.hypot(target.x - from.x, target.y - from.y) || 1
  const dur = springDuration(spring)
  const n = Math.max(20, Math.round(dur * 60))
  const frames: Keyframe[] = []
  for (let i = 0; i <= n; i++) {
    const k = i === n ? 0 : springAt((i / n) * dur, spring, 1, -v0 / dist)
    const lerp = (a: number, b: number) => b + (a - b) * k
    frames.push({ transform: `translate(${lerp(from.x, target.x)}px, ${lerp(from.y, target.y)}px) scale(${lerp(from.scale, target.scale)})` })
  }
  el.style.transform = end
  const anim = el.animate(frames, { duration: dur * 1000, easing: 'linear' })
  return anim.finished.then(() => undefined, () => undefined)
}
