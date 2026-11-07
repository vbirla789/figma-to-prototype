# The match loop

## How it works

`tools/compare.mjs` opens the route in Chrome at the Figma frame's exact size and pixel density,
with animations and transitions disabled and the phone mockup turned off (`?capture`), waits for
fonts, screenshots it, and diffs it pixel-by-pixel against the Figma export.

It then:
- splits the mismatched pixels into **regions** (8px cells that differ, joined to their neighbours);
- for each region, searches ±16px for a shift that makes the build line up with Figma:
  - **offset**: a shift fixes it → same content, wrong position;
  - **content**: no shift fixes it → it looks different;
  - **noise**: average difference is tiny → text rasterisation (Figma and Chrome render glyph
    edges slightly differently). Ignored for PASS.
- groups offset regions that share the same shift: one shared shift almost always has one cause;
- checks which CSS font families can't be rendered (`missingFonts`).

PASS = no offset or content regions and overall mismatch ≤ `--pass` (1%).

## Getting the reference image

```text
get_screenshot(fileKey, nodeId, maxDimension = max(frameW, frameH))
→ curl -f -L -o .compare/<route>/figma.png "<image_url>"
```
`get_screenshot` exports at up to 1× the frame size, which is enough. For a 2× reference use
`download_assets` with `defaultScale: 2` and pass the same `--width` (the frame width). The
script infers the density from the image width.

If the frame includes a status bar and home indicator (most phone frames do), use the default
`--capture full`; the shell's mock bars are drawn in capture mode so the frame lines up. If the
frame is content-only, use `--capture screen`. Web pages: `--capture none`.

States that live in their own Figma frames (sheet open, error, filled form) need their own route or
query param (`/cart?sheet=promo`) so the capture is deterministic. `--eval "<js>"` exists for the
odd case, but a URL is better. The designer can share it too.

## Reading the report

```
FAIL  /checkout  mismatch 3.4%  5 region(s) to fix  frame 375x812 @1x
  ! fonts not available: Inter Display
  first divergence at y=118px — fix from the top down; offsets cascade
  ⇢ 4 regions all 4px lower → look for ONE cause at or above y=118px (padding, gap, line-height, an element's height)
  #1  x16 y118 343x56  offset: build content sits 4px lower than in the design → .compare/checkout/region-1.png
  #5  x16 y700 343x48  content: same place, looks different … → .compare/checkout/region-5.png
```

Always open the crops for the top regions (Read the PNG): `Figma | build | diff`, with the diff
painting mismatched pixels red. The text diagnosis tells you where; the crop tells you what.

`report.json` in the output folder has the same data for scripting.

## Fix order

1. **Fonts.** A fallback font changes every text width and height. Nothing else is worth fixing
   until `missingFonts` is empty.
2. **Size note.** If the build renders taller or shorter than the frame, the screen's root layout is
   wrong (a missing `height:100%`, a page that scrolls instead of the screen scroller).
3. **First divergence, top-down.** Find the element at or just above that y in the build
   (`data-node-id` helps) and compare its box to `get_metadata` for the same node.
4. **Offset groups** before single regions. One fix often clears the whole group.
5. **Content regions** last: these are colours, radii, weights, icons, missing elements.

Re-run after each fix (it takes a few seconds). Don't batch ten guesses.

## Cause → fix

| Symptom | Usual cause | Fix |
|---|---|---|
| Everything below a point is N px lower/higher | An element above is N px too tall/short: padding, gap, a text line-height, an icon frame size, a divider | Compare that element's height with `get_metadata`; fix the property, not the position |
| Text rows creep further off the further down they are | line-height `normal` vs Figma's px value, or paragraph spacing | Set the px line-height from the text style |
| Text starts at the right place but wraps differently | text box sizing mode (fixed/auto width), letter-spacing, wrong weight, fallback font | Fix the font first, then width mode and letter-spacing |
| Content offset sideways by N px | horizontal padding, a gap, an icon frame width, centring vs left alignment | Compare padding/gap with design context |
| A box is right but its edge differs | stroke inside vs outside vs center, or a double border (row border + divider) | See building.md §4 |
| Corners differ (diff shows 4 small arcs) | radius value, or radius on the wrong element (parent clipping) | Copy the per-corner radius; check `overflow:hidden` on the parent |
| Faint halo around a card | shadow blur/spread/opacity, or the shadow on the wrong layer | Copy each shadow exactly, in order |
| Whole area slightly the wrong colour | fill opacity vs layer opacity, a fill stack, the wrong token | Recheck fills; see building.md §5 |
| Icon region is "content" | wrong icon, or a cropped SVG export | Re-export the icon frame (building.md §6) |
| Image region differs | `object-fit`/crop position, or a lower-resolution image | Match the fill mode; use the original image |
| Region over a clock, avatar initials, random data | dynamic content | Make the prototype show the Figma values (9:41, same names) |
| Regions only along text edges, low difference | `noise`: rasterisation | Ignore, unless the crop shows something real |

## Stopping

- PASS → done for that screen. Move on.
- After ~5 rounds, if only `noise` or explainable regions remain, stop and record them in the
  README's screen map ("checkout: 0.6%, Figma squircle corners on CTA not reproducible in CSS").
- If a region resists three honest fixes, re-read the node with `get_design_context` and look at
  the crop at full size: usually the structure is different from what you assumed (an element is
  absolutely positioned in Figma, or a "divider" is actually a stroke). Rebuild that section rather
  than nudging it.
- Never add offsets, transforms or magic margins just to make pixels line up. The prototype has to
  stay right at other phone widths, and fudges break there.
