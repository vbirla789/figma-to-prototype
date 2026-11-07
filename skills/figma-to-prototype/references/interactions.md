# Interactions and motion

A prototype is judged in the first five taps. Every link the designer drew must work, everything
tappable must respond to the finger, and transitions must feel like the platform.

## Contents
1. Reading prototype links
2. Mapping Figma transitions to code
3. Overlays: sheets, dialogs, toasts
4. Interactions nobody drew
5. Motion tokens (and plugging in a team standard)
6. Gestures
7. Figma animations (Smart animate, motion)
8. Checking it

## 1. Reading prototype links

`get_design_context` and `get_metadata` don't include prototype connections. Read them with the
Figma Plugin API through `use_figma` (load the `figma-use` skill first if it's installed; it's
required before `use_figma`). A read-only script:

```js
// pass the flow's frame ids
const frameIds = ['12:345', '12:678'];
const out = [];
for (const id of frameIds) {
  const frame = await figma.getNodeByIdAsync(id);
  if (!frame) continue;
  const walk = (n) => {
    if ('reactions' in n && n.reactions.length) {
      out.push({
        frame: frame.name, node: n.id, name: n.name,
        reactions: n.reactions.map((r) => ({
          trigger: r.trigger, // {type: 'ON_CLICK' | 'ON_DRAG' | 'AFTER_TIMEOUT' | 'ON_HOVER' | 'ON_PRESS' | …}
          actions: (r.actions ?? [r.action]).filter(Boolean).map((a) => ({
            type: a.type, navigation: a.navigation, destinationId: a.destinationId,
            transition: a.transition, // {type: 'DISSOLVE'|'SMART_ANIMATE'|'MOVE_IN'|'PUSH'|'SLIDE_IN'…, direction, duration, easing}
            overlay: a.overlayRelativePosition,
          })),
        })),
      });
    }
    if ('children' in n) n.children.forEach(walk);
  };
  walk(frame);
}
return out;
```

If `use_figma` isn't available, ask the designer to describe the flow in one line per screen, or
infer it from frame names and order, and **list your assumptions** in the hand-off.

Write each link into the screen map: `Home / "Orders" row → /orders (push)`.

## 2. Mapping Figma transitions to code

| Figma | Prototype code |
|---|---|
| Navigate, Instant | `go(to, 'none')` |
| Navigate, Push / Slide in from right | `go(to, 'push')` |
| Back, or Push from left | `go(-1, 'pop')` |
| Move in / Slide in from bottom (full screen) | `go(to, 'up')`; closing → `go(-1, 'down')` |
| Dissolve | `go(to, 'fade')` |
| Smart animate between two screens | shared-element morph (§7), or `fade` with the moving element on a spring |
| Open overlay, bottom-anchored | `<Sheet>` |
| Open overlay, centred | dialog in the phone overlay: scrim fade + panel scale 0.96→1 & fade |
| Open overlay, top / manual position | positioned panel in the phone overlay |
| Swap overlay | change the sheet's content in place (fade old out, new in) |
| Close overlay | the overlay's `onClose` |
| Scroll to | `element.scrollIntoView({ behavior: 'smooth' })` |
| Change to (component variant) | React state on that component; animate the changed properties |
| After delay | `setTimeout` after the screen is visible (cancel on unmount) |
| Open link | `<a href target="_blank" rel="noopener">` |

Figma's own durations/easings on links are usually defaults nobody tuned. Use the motion tokens
unless the designer clearly set custom values on purpose (an unusual duration or a custom bezier).

## 3. Overlays: sheets, dialogs, toasts

Render overlays into the phone overlay (`PHONE_OVERLAY_ID`), never into `document.body` in app
mode. The overlay host stays inside the mockup on a laptop and fills the screen on a phone.
`Sheet` already does this.

- `Sheet` gives you the spring rise, scrim fade, drag-to-dismiss (distance or flick), tap-scrim to
  close. Restyle it to the Figma sheet (radius, grabber, padding, scrim colour), then match-loop
  its open state (`?sheet=…` route param).
- Dialogs: scrim fades in (`--ms-scrim`, `--ease-out`), panel fades + scales from 0.96. Exit
  faster than enter.
- Toasts: slide 16–20px + fade in, auto-dismiss after ~3s, swipe to dismiss if it's big.

## 4. Interactions nobody drew

Designers draw the happy path. Users press, scroll and swipe. Add these unless the designer says
otherwise:

- **Press feedback** on every tappable element: `className="press"` (controls), `press--wide`
  (full-width rows, CTAs), `press--icon` (icon buttons). Rows can also darken their background.
- **Back**: every pushed screen's back control does `go(-1, 'pop')`. The browser back button
  works automatically because routes are real.
- **Scrolling**: the screen scrolls inside the shell; Figma "fixed" elements (headers, bottom
  bars) → `position: sticky` (top/bottom 0) inside the scroller, so they stay put.
- **Tabs / segmented controls** switch with `fade` or an underline that slides on the spring.
- **Inputs** focus, accept typing, and show the Figma focused/filled/error variants if they exist.
- **Loading** (if the design shows skeletons): show the skeleton for ~600ms, then fade in content.
- **Disabled** states from variants stay non-interactive.

List every interaction you inferred in the hand-off report, so the designer can veto it.

## 5. Motion tokens

All values live in `src/motion/motion.ts` (`MOTION`) and are published as CSS variables:

| Token | CSS var | Default | Use |
|---|---|---|---|
| `spring.move` | `--spring-move`, `--spring-move-ms` | ω 17, ζ 0.85 (~520ms, <1% overshoot) | screens, sheets, cards, anything that moves |
| `spring.gentle` | `--spring-gentle` | ω 13, ζ 0.95 | large surfaces, morphs carrying text |
| `spring.snappy` | `--spring-snappy` | ω 24, ζ 1 | toggles, small controls, press release |
| `spring.pop` | `--spring-pop` | ω 15, ζ 0.55 | celebrations only (like, success) |
| `ease.out` / `ms.fadeIn` | `--ease-out`, `--ms-fadeIn` | strong ease-out, 200ms | things appearing, fading in |
| `ease.in` / `ms.fadeOut` | `--ease-in`, `--ms-fadeOut` | 150ms | things leaving (exits are quicker) |
| `ms.scrim` | `--ms-scrim` | 300ms | scrims, backgrounds |
| `ms.stagger` | `--ms-stagger` | 40ms | list items entering (cap at ~6 items) |
| `press.*` | `--press-control` etc. | 0.96 / 0.98 / 0.92 | press scale |

Use a CSS spring like this: `transition: transform var(--spring-move-ms) var(--spring-move);`.
In JS, `springTo(el, { y: 0 }, { v0 })` starts from the element's current position (interruptible)
and carries gesture velocity.

Principles behind the defaults:
- Split by property: position/size/scale on a spring, opacity/colour/blur on a curve.
- Ease-out for anything entering; never ease-in for an entrance (it feels laggy).
- No visible bounce on task UI. Overshoot is reserved for rewards.
- Animate `transform` and `opacity` (plus `clip-path`, colours), never `height`/`top`/`left`
  on large areas, since they stutter on phones.
- Exits are faster and quieter than entrances.
- Interruptible: a second tap mid-animation retargets from where things are, never snaps back.

**Team standard.** If the designer's team has a motion standard (a tokens file, a motion skill, or
ProtoPie/Principle values), replace the numbers in `MOTION` with theirs. Convert a stiffness/damping
spring with `w = sqrt(stiffness / mass)`, `z = damping / (2 * sqrt(stiffness * mass))`. Follow
their choreography rules over these defaults. If the Emil Kowalski motion skills (`animate`,
`review-animations`, `apple-design`, `mobile-native`) are installed, use them for judgement calls
and reviews.

## 6. Gestures

- Horizontal carousels: CSS scroll-snap (`scroll-snap-type: x mandatory`) before any JS. It's
  native, momentum-correct and accessible.
- Swipe-to-dismiss / drag: pointer events with `setPointerCapture`, axis-lock after ~8px, follow
  the finger 1:1, rubber-band past limits (`sqrt` of overshoot), release on `springTo` with the
  measured velocity. Decide by distance **or** velocity (flick > ~600px/s).
- Don't start a drag from a button: check `closest('button, a, input')` on pointerdown, or the
  pointer capture will swallow the click.
- `touch-action: pan-y` on vertical scrollers containing horizontal drags (and vice versa).
- Long-press menus: ~500ms, cancel on move > 8px.

## 7. Figma animations

- **Smart animate** between two frames: identify layers with the same name in both frames.
  Those are the morphing elements. Build one screen with state, and animate the changed
  properties (position/size on the spring, opacity/colour on curves). For a card → full-screen
  expansion, use a FLIP or View Transition shared element (`view-transition-name` on both).
- **Motion / keyframe animations** in the file: `get_motion_context` returns keyframes and easing
  as CSS/@keyframes. Use those values for that animation (they're deliberate).
- **Lottie / video** layers: ask for the source file; don't approximate with CSS.

## 8. Checking it

The preview pane can throttle animation frames while hidden, so don't judge motion smoothness
from it. Verify behaviour by end state (route, element visible, `data-state`) and let the designer
judge feel on the device. Do click through every link in the screen map at least once in the
browser, at phone size, and confirm each lands on the right route and back works.
