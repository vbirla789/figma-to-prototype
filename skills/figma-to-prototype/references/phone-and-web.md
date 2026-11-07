# Phone shell and responsive web

## App mode: what the shell does for you

`src/shell/PhoneFrame.tsx` wraps every route.

| Where | Behaviour |
|---|---|
| Laptop / desktop | Phone-sized frame (Figma frame width; height = frame height, capped to the window), rounded corners and shadow on a neutral stage, mock status bar (9:41) and home indicator at the Figma heights. Screens scroll inside the frame. |
| Real phone, portrait (≤520px wide) | Mockup gone: no stage padding, no rounded frame, no fake status bar or home indicator. App fills `100dvh` and pads with `env(safe-area-inset-*)` so content clears the notch and home bar. |
| Real phone, landscape (touch screen ≤520px tall) | Same full-bleed behaviour, with left/right safe areas. |
| `?capture` | Exactly the viewport, no stage, mock bars shown (or hidden with `?capture=screen`), for the match loop. |

Also handled: `theme-color` and page background follow each screen via
`useChrome(background, tone)`, so Safari/Chrome paint their own bars to match (call it at the top
of every screen with the colour behind its status bar: `useChrome('#000', 'light')` for dark
screens). Fixed-position overlays stay inside the mockup on desktop (`transform: translateZ(0)` on
the shell). The page never rubber-bands; only the screen scrolls.

## What screens must do

- **Fill the screen, don't size to the frame.** Root element `min-height: 100%` (or a flex column
  with the content area `flex: 1`). Never `width: 375px` or `height: 812px`.
- **Bottom bars and CTAs** pinned to the bottom: put them at the end of a flex column with
  `margin-top: auto`, or `position: sticky; bottom: 0` inside the scroller. Add
  `padding-bottom: calc(<figma padding> + env(safe-area-inset-bottom))` only if the bar is drawn
  to the very bottom edge. On desktop, env() is 0, so the Figma value is unchanged.
- **Full-bleed backgrounds** (a coloured header behind the status bar) need `useChrome` with that
  colour, or the real status bar area shows the wrong colour.
- **Inputs** stay ≥16px on touch devices (the base CSS enforces it) or iOS zooms the page on focus.
  If Figma uses 14px inputs, keep 14px on desktop. The rule only applies to coarse pointers.
- **No hover-only affordances.** Hover styles go inside `@media (hover: hover)`.
- **Keyboard:** when an input focuses on a phone, the visual viewport shrinks. Bottom-pinned
  CTAs inside the scroller stay reachable; avoid `position: fixed` bottoms that hide behind it.
- **Horizontal scroll** only where intended (carousels), and those use `overscroll-behavior-x:
  contain` so they don't trigger browser back-swipe.

## Phone checks

Run these with the preview tools (or Chrome DevTools device mode). Use `resize_window` presets or
custom sizes, and reload after resizing.

| Size | Why |
|---|---|
| 360×740 | small Android: catches text that wraps or overflows |
| 390×844 | common iPhone |
| 430×932 | large iPhone: catches things that don't stretch |
| 844×390 | landscape phone: shell must stay full-bleed |
| desktop | mockup visible, centred, nothing escapes the frame |

On each: `document.scrollingElement.scrollWidth <= innerWidth` (no sideways scroll), the header
isn't under the status bar, the bottom CTA isn't under the home bar, sheets open inside the right
box, and fixed elements stay fixed while the screen scrolls.

For a real device, the dev server listens on the network: `http://<laptop-ip>:<port>` on the
same Wi-Fi. (`ipconfig getifaddr en0` on macOS gives the IP.)

## Web mode

No shell. The page is a normal responsive document.

- If the designer gave several widths (e.g. 1440, 1024, 768, 375), those are the breakpoints:
  build mobile-first or desktop-first, but each Figma width must PASS the match loop at that width
  (`--width 1440`, `--width 375`, each with its own reference image).
- If only a desktop frame exists, keep the content container at the Figma content width
  (`max-width` + `margin-inline: auto`), let backgrounds bleed full width, and make sure it
  degrades sensibly to tablet and phone (stack columns, wrap nav). Tell the designer which parts
  you adapted without a design.
- Sticky headers, anchor scrolling and hover states matter on web. Build the hover/focus variants
  if they exist in the file.
- Long pages: the match loop captures the full frame height (viewport height = frame height), so
  below-the-fold sections are checked too.
