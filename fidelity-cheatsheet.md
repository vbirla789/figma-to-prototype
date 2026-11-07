# Fidelity cheatsheet

The small translations that make a Figma build feel "almost right". Each one is a real cause of
drift that the `figma-to-prototype` match loop keeps catching. Use it when reviewing any
design-to-code work, with or without the skill.

## Layout

| In Figma | Usually built as | Should be |
|---|---|---|
| Auto layout, gap 12 | margins on children | `display:flex; gap:12px` |
| Child set to **Fill** | fixed width `343px` | `flex:1 1 0; min-width:0` / `align-self:stretch` |
| Child set to **Hug** | a guessed width | no width |
| Frame 375 wide | `width:375px` on the screen | `width:100%`. Spacing is exact, widths are fluid |
| Space between | gap guessed in px | `justify-content:space-between` |
| Absolute child inside auto layout | flowed with siblings | `position:absolute` in a relative parent |

## Text

| In Figma | Usually built as | Should be |
|---|---|---|
| Line height 20 | browser default (`normal`) | `line-height:20px`; rows stop creeping down |
| Letter spacing −2% | ignored | `letter-spacing:-0.02em` |
| Font "Inter Display" | silently falls back | load the real font; fallback widths move every line |
| Text box Fixed width | auto width | set the width; different wrapping shifts everything below |
| Truncate after 2 lines | overflow hidden | `-webkit-line-clamp:2` |

## Edges

| In Figma | Usually built as | Should be |
|---|---|---|
| 1px **inside** stroke | `border:1px` (adds 2px to the box) | `box-shadow: inset 0 0 0 1px` |
| **Outside** stroke | `border` | `outline` or `box-shadow: 0 0 0 1px` |
| Divider as its own line node | border on the row | its own 1px element, with its insets |
| Row stroke **and** a divider | both | one of them (doubled lines look heavy) |
| 0.5px stroke | rounded to 1px | keep `0.5px`; it's crisp on phones |
| Per-corner radius 16 16 0 0 | `border-radius:16px` | `border-radius:16px 16px 0 0` |

## Fills and effects

| In Figma | Usually built as | Should be |
|---|---|---|
| Layer opacity 60% | `opacity:.6` on the fill colour | `opacity` on the element; fill opacity is rgba on the fill only |
| Two stacked fills | the top one only | multiple `background` layers, top first |
| Drop shadow 0 4 12 0 #000 10% | a guessed shadow | `box-shadow:0 4px 12px 0 rgba(0,0,0,.1)` |
| Background blur 40 | `blur(40px)` | `backdrop-filter: blur(20px)` (≈ half), plus `-webkit-` |
| Image fill "Fill" | stretched `<img>` | `object-fit:cover` (+ `object-position` for crops) |

## On a real phone

| Problem | Fix |
|---|---|
| Fake status bar / home bar drawn twice | the screen never draws them; the phone shell shows them on desktop only |
| Content under the notch or home bar | `viewport-fit=cover` + `env(safe-area-inset-*)` padding |
| `100vh` jumps when the browser bar hides | `100dvh` |
| Page zooms when an input is focused | inputs ≥16px on touch devices |
| Grey flash on tap | `-webkit-tap-highlight-color: transparent` |
| Hover stays "stuck" after a tap | hover styles inside `@media (hover:hover)` |
| Browser bar wrong colour on dark screens | update `<meta name="theme-color">` per screen |

## Motion

| Situation | Use |
|---|---|
| Something moves or resizes | a spring (no visible bounce on task UI) |
| Something fades | ease-out in (~200ms), quicker ease-in out (~150ms) |
| Entering | ease-out. Ease-in on entrances feels laggy |
| Tappable element | press scale 0.96 (controls), 0.98 (wide rows), 0.92 (icons) |
| Animating height/top on a big area | animate `transform` instead |
| User prefers reduced motion | keep fades, drop movement |
