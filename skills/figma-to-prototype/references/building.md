# Figma → CSS, exactly

Most of the "15% off" comes from a small set of translations that look right but aren't. This file
is the lookup table.

## Contents
1. Getting exact values
2. Auto layout and sizing
3. Text
4. Strokes, dividers, borders
5. Fills, effects, radius
6. Images and icons
7. Components and variants
8. Things that aren't screen content

## 1. Getting exact values

| Need | Tool | Note |
|---|---|---|
| Structure, exact x/y/w/h of every layer | `get_metadata` | Cheap, never truncates. Use it to check positions |
| Styles, layout, text, asset URLs | `get_design_context` | Call per section on large frames. Its absolute `top-[…]` values can be wrong for nested/auto-layout children; trust `get_metadata` and the screenshot over them |
| Variables / tokens | `get_variable_defs` | Keep Figma's names |
| The truth | `get_screenshot` | When the numbers and the picture disagree, the picture wins; measure it |
| Original images, SVG icons, 2× renders | `download_assets` | URLs are short-lived; download immediately |

Convert the Tailwind in `get_design_context` output into plain CSS with tokens. Arbitrary values
like `w-[343px]` are clues to the Figma value, not something to copy blindly. Ask what the layer's
sizing mode was (Fill / Hug / Fixed) before turning a width into CSS.

## 2. Auto layout and sizing

| Figma | CSS |
|---|---|
| Auto layout vertical / horizontal | `display:flex; flex-direction: column / row` |
| Gap N (or "Auto" spacing) | `gap: Npx` (or `justify-content: space-between`) |
| Padding T R B L | `padding` in px, exactly. Asymmetric padding is usually intentional |
| Align (9-dot grid) | `justify-content` on the main axis, `align-items` on the cross axis |
| Child **Fill** on main axis | `flex: 1 1 0; min-width: 0` (row) / `min-height: 0` (column) |
| Child **Fill** on cross axis | `align-self: stretch` |
| **Hug** | no size; let content size it |
| **Fixed** | the px size, except the screen width itself (stays fluid) |
| Min/max width | `min-width` / `max-width` |
| Wrap | `flex-wrap: wrap` + `row-gap` from "vertical gap between rows" |
| Child with "absolute position" inside auto layout | parent `position: relative`, child `position:absolute` with the constraint edges |
| Constraints (non-auto-layout frame): Left/Right/Center/Scale | `left`/`right`/`left:50%;translate`/percent values |
| "Clip content" on | `overflow: hidden` (with `isolation: isolate` if it clips rounded children with blur) |
| Strokes included in layout (toggle) | if on, the stroke takes space: use `border`; if off, it doesn't: inset shadow / outline |

The frame itself is never a fixed 375px box. The screen root is `width: 100%`; full-width
children stretch. That's what keeps the build right at 360 and 430 as well as at 375.

## 3. Text

Set all five, from the text style, on every text element: `font-family`, `font-weight`,
`font-size`, `line-height`, `letter-spacing`.

- **line-height** in px exactly as Figma says. "Auto" = the font's natural height; use `normal`, but
  check the frame: if rows sit lower than Figma, the font's natural height differs from Figma's.
  Set an explicit px value measured from `get_metadata` (text node height ÷ lines).
- **letter-spacing**: Figma % → `em` (−2% → `-0.02em`); px stays px.
- **Paragraph spacing** → `margin-bottom` between paragraphs, not line-height.
- **Text box Fixed width** → set the width (or Fill); **Auto width** → `white-space: nowrap`;
  **Auto height** → normal wrapping. Wrong mode = different wrapping = everything below shifts.
- **Truncate** ("…" at N lines) → `display:-webkit-box; -webkit-line-clamp:N; -webkit-box-orient:vertical; overflow:hidden`.
- **Text case** upper/title → `text-transform`; underline/strike → `text-decoration`, with
  `text-underline-offset` if Figma's differs.
- **Font features** (tabular numbers, etc.) → `font-variant-numeric` / `font-feature-settings`.
- Vertical text centring in a fixed-height button: use flex `align-items:center` and the exact
  line-height. Don't use padding guesses.
- Mixed styles inside one text layer → `<span>`s with their own styles.

## 4. Strokes, dividers, borders

| Figma | CSS |
|---|---|
| Inside stroke, N px | `box-shadow: inset 0 0 0 Npx color` (doesn't change size), or `border` with `box-sizing:border-box` when "strokes included in layout" is on |
| Center stroke | half inside, half outside: `outline: Npx solid; outline-offset: -N/2px` |
| Outside stroke | `outline: Npx solid color` or `box-shadow: 0 0 0 Npx color` |
| Single-side stroke (top/bottom only) | `border-bottom` / `box-shadow: inset 0 -1px 0` |
| A **line or 1-px rectangle node** used as divider | a real element (`<hr>` or `div` with height 1px) placed exactly as in auto layout. It occupies the gap it occupies in Figma |
| 0.5 px strokes | `0.5px` works on 2×/3× screens; on 1× it rounds. Keep 0.5px; don't "fix" it to 1px |
| Dashed stroke | `border-style: dashed`; for custom dash lengths, an SVG or `background-image` repeating gradient |

Dividers are the most common "feels off" item: check whether it's inset (has margins), whether it's
a stroke on the row or its own node, its exact colour/opacity, and that it isn't doubled (a row
border plus a divider).

## 5. Fills, effects, radius

- **Multiple fills** stack top-to-bottom in Figma → CSS `background` layers in the same order
  (the first CSS layer is on top).
- **Layer opacity** vs **fill opacity**: layer opacity → `opacity` (affects children); fill
  opacity → rgba on the fill only. Mixing them up dims text that shouldn't be dim.
- **Gradients**: linear angle from the handles; Figma's handles don't map to CSS degrees one-to-one.
  Read the stops/positions from design context, then compare the crop.
- **Drop shadow** X Y Blur Spread → `box-shadow: Xpx Ypx Blurpx Spreadpx color`. Multiple shadows,
  comma-separated in the same order. **Inner shadow** → `inset`.
- **Layer blur** → `filter: blur(Npx)`. **Background blur** → `backdrop-filter: blur(Npx)` (CSS blur ≈
  Figma's value ÷ 2 for a visual match, e.g. Figma 85 → `blur(42.5px)`; verify in the crop) plus `-webkit-backdrop-filter`.
- **Corner radius** per corner → `border-radius: TL TR BR BL`. Corner smoothing (squircle) can't
  be done in plain CSS. Leave it as normal radius and note it, unless it's a large hero shape
  (then an SVG mask).
- **Blend modes** → `mix-blend-mode`.
- Colours: copy the hex/rgba exactly from the variable or fill, including alpha.

## 6. Images and icons

- Photos: download the original image fill (`download_assets` rawImages) and match the **fill
  mode**: Fill → `object-fit: cover`, Fit → `contain`, Crop → `object-fit: cover` +
  `object-position` from the crop offset (check the crop), Tile → `background-repeat`.
- Icons: export as SVG (`download_assets` svgAssets, or design-context asset URLs). If an exported
  icon comes out cropped or offset (common with icons built from strokes or boolean groups), export
  the **icon's frame** node instead of the vector, or ask the designer for the SVG.
- Keep the icon's frame size (e.g. 24×24 with a 20×20 glyph inside). Matching the glyph size
  but not the frame shifts neighbours.
- Avatars / initials / flags made of shapes → build them in CSS, but match sizes exactly.
- Use 2× raster images for crisp phones; size them in CSS to the 1× dimensions.

## 7. Components and variants

- A Figma component used several times → one React component with props for its variants
  (`state="pressed"`, `size="sm"`). Variant names usually tell you the states to build.
- Instance overrides (text, icon swaps, hidden layers) → props, not copies.
- If the file uses a published design system and the project has its code, use that instead of
  rebuilding it, but still run the match loop.

## 8. Things that aren't screen content

- **Status bar** and **home indicator** layers: skip them. The shell draws them on desktop and the
  real phone draws its own.
- **Keyboard** images in a frame mean "the keyboard is open here". Build the input focused state
  and let the real keyboard appear; don't render a picture of a keyboard.
- **Annotations, redlines, sticky notes, frame labels**: not UI. Read them, because they often
  describe the interaction.
- **Hidden layers** (`visible: false`) are states. Keep them as conditional UI when they look like
  states (error text, selected tick), otherwise ignore them.
