---
name: figma-to-prototype
description: Turn a Figma link into a working, pixel-accurate React prototype — app flows in a phone mockup that goes full-bleed on a real phone, or responsive web pages — with real navigation, interactions and motion. It builds every screen, then measures each one against the Figma export with a pixel-diff loop and fixes the drift (padding, dividers, radius, line-height, colours) until it matches. Use this whenever someone shares a figma.com design link and wants it built, coded, prototyped, "made clickable", "made real", turned into React/HTML, or checked for 1:1 accuracy against the design — even if they only paste the link and say "build this" or "make a proto". Also use it to re-sync a prototype after the Figma design changed, or to audit how far an existing build has drifted from its Figma frames.
---

# Figma → prototype

A designer pastes a Figma link; you hand back a prototype they can open on their phone that looks
exactly like the design and moves like a real app.

Plain Figma-to-code gets about 85% of the way. The last 15% (a gap 4px off, a 1px divider that came
out as 2px, a line-height that pushes every row down, a font that silently fell back) is the
difference between "looks like a prototype" and "looks like the design". Nobody can see that 15%
by eye at screen speed, so this skill **measures** it: every screen is rendered at the Figma frame's
exact size and diffed against the Figma export, region by region, until it passes.

Three promises, in priority order:
1. **1:1 with the design**: measured, not eyeballed.
2. **Right on a real phone**: no fake status bar or home indicator, no mockup padding, safe areas
   respected, fluid to any phone width.
3. **Solid interactions**: every Figma prototype link works, with motion that feels native.

## What you need before starting

- **Figma MCP** connected (the `get_design_context`, `get_screenshot`, `get_metadata`,
  `get_variable_defs`, `download_assets` tools). If it isn't, stop and tell the designer how to
  connect it. Nothing below works without it.
- **Node 20+** and **Google Chrome** on the machine (the match loop drives Chrome). Check with
  `node -v`. If Chrome is missing, `npx playwright install chromium` works instead.
- The Figma `design-to-code` skill, if installed, is required before `get_design_context`; load it.

Ask the designer as little as possible. Infer everything you can from the file. The only things
worth confirming, in one message, are:
- **Which frames are the flow, and in what order**, when the link points at a page or section with
  many frames. List what you found (name, size) and propose an order.
- **Their motion standard**, if their team has one (a tokens file, a motion skill, ProtoPie values).
  Otherwise the built-in defaults are used. Don't block on this.

## Workflow

### 1. Read the flow

Parse the link: `figma.com/design/<fileKey>/<name>?node-id=<a>-<b>` → nodeId `a:b` (a branch URL
uses the branch key as fileKey). Call `create_session` first if the Figma server asks for it.

- `get_metadata` on the linked node lists every frame with its exact x/y/size. Top-level frames
  are screens; frames whose names say "sheet", "modal", "dialog", "toast", "dropdown" are usually
  overlays of a screen, not routes.
- **App or web?** Frame width ≤ 500 → app (phone shell). Wider → web. Several widths of the same
  page (e.g. 1440 + 768 + 375) → one responsive web page with those breakpoints.
- Read the **prototype connections** (which element goes where, with which transition). See
  [interactions.md](references/interactions.md#reading-prototype-links). They define navigation.
- Export each frame as the reference image for the match loop:
  `get_screenshot` (maxDimension = the frame's longer side) → `curl` the returned URL to
  `.compare/<route>/figma.png`. Do this now, while the URLs are fresh.

Write a short **screen map** before coding and keep it in the project README:
`route ← Figma frame name (node id, W×H) — overlays — outgoing links`.

### 2. Scaffold

```bash
bash <skill-dir>/scripts/new-prototype.sh <dest> "<Title>" app 375 812 44 34
bash <skill-dir>/scripts/new-prototype.sh <dest> "<Title>" web 1440 1024
```
`<skill-dir>` is the folder this SKILL.md is in. Arguments: mode, frame width/height, then (app only) the status-bar and home-indicator heights as
drawn in the Figma frame (44/34 for 375×812; 47 or 54/34 on newer iPhone frames; 24/0 on Android).

The template gives you: the phone shell (`src/shell/PhoneFrame`), motion tokens and helpers
(`src/motion/`), route transitions (`useGo`), a bottom `Sheet`, a mobile-safe CSS base, and
`tools/compare.mjs`. Read `src/config.ts` and `src/shell/PhoneFrame.tsx` once so you know what the
shell already handles.

Then, before any screen:
- **Fonts.** Find every font family and weight in the design (from `get_design_context` /
  `get_variable_defs`) and load the real files in `index.html` or `src/styles`. A fallback font
  moves every line of text, so the match loop will flag it as `missingFonts`. Fix it first. If a
  font is proprietary and you can't find it, ask the designer for the files or CDN URL.
- **Tokens.** `get_variable_defs` → `src/styles/tokens.css`, keeping Figma's variable names
  (`Text/Primary` → `--text-primary`).
- **Assets.** Icons and illustrations as SVG files, photos at 2× (`download_assets`, or the asset
  URLs `get_design_context` returns). Download them into `src/assets/`. Asset URLs expire.

### 3. Build each screen

Work one screen at a time, top section to bottom. For big frames, call `get_design_context` per
section (the child nodes from `get_metadata`) rather than on the whole screen; whole-screen calls
on large frames time out or come back truncated.

The design-context output is a **reference, not code to paste**. It's usually Tailwind with
absolute values; translate it into the project's plain CSS (one CSS file per screen or component)
using the tokens. Read [building.md](references/building.md) for how Figma properties map to CSS.
That's where most of the 15% comes from. Rules that matter most:

- **Auto layout → flexbox, exactly.** Padding, gap, alignment, Fill (`flex: 1` / `align-self:
  stretch`), Hug (`auto`), Fixed (px). Don't swap a gap for margins or an absolute layout for flex.
- **Widths are fluid, spacing is exact.** Copy every padding, gap, size, radius and type value
  from Figma, but never hard-code the frame width (375px) on a container. The same screen must
  work at 360, 390 and 430 wide.
- **Text boxes carry their line-height.** Set `font-size`, `line-height` (px from Figma),
  `letter-spacing` (Figma % → em: 2% = 0.02em) and weight on every text style.
- **Strokes:** Figma inside stroke → `box-shadow: inset 0 0 0 Npx` or `border` with border-box;
  center/outside strokes don't take layout space, so use `outline` or a shadow. Dividers that are
  separate line/rectangle nodes are elements, not borders.
- **Don't build the status bar or home indicator** even when they're layers in the frame. The
  shell owns them, and hides them on a real phone.
- **Every frame and state is reachable by URL**: a route per screen, plus `?state=` or
  `?sheet=` for overlay/state frames. That's how the match loop captures them, and it lets the
  designer share a link to any state.
- Tag each block with `data-node-id="<figma id>"` so a mismatch can be traced back to its Figma node.

### 4. Match loop (every screen, every state)

Start the dev server (on Claude Code desktop add a `.claude/launch.json` entry and use the preview
tools; otherwise `npm run dev`), then:

```bash
node tools/compare.mjs --route /cart --figma .compare/cart/figma.png --width 375
#   --capture screen   if the Figma frame has no status bar / home indicator
#   --capture none     for web pages
#   --eval "…"         to open a state that has no URL (prefer adding a URL)
```

It prints PASS/FAIL, the first row where the build diverges, offset groups ("7 regions all 4px
lower → one cause above y=64"), and per-region diagnoses with crop images
(`region-N.png` = Figma | build | diff). **Look at the crops** (Read the PNG); the diagnosis says
where to look, the crop shows what's wrong. Then:

1. Fix `missingFonts` and size mismatches first.
2. Fix **top-down**. A wrong height near the top shifts everything below it, so one fix often
   clears ten regions. Re-run after each meaningful fix.
3. Find the real Figma value for what's wrong (get_design_context on that node, or `get_metadata`
   for exact x/y/size) and use it. **Never fudge**: no magic negative margins or `top: 3px` nudges
   to make pixels line up. If a fudge is the only way, the structure is wrong.
4. Stop when it PASSes, or after ~5 rounds when only `noise` or explainable regions remain
   (dynamic content, a real-time clock, images Figma crops differently). Write any remaining known
   difference in the README; don't hide it.

Details, the full cause→fix table and how to read the report: [match-loop.md](references/match-loop.md).

### 5. Interactions and motion

Wire every prototype connection, then the behaviour the design implies but didn't draw (pressed
states, scrolling, sheets dismissing, back gestures). Read [interactions.md](references/interactions.md).
In short:

- Navigation goes through `useGo()`: `push`/`pop` for drill-in/back, `up`/`down` for full-screen
  modals, `fade` for tabs. Figma overlays → `Sheet` or a dialog in the phone overlay.
- Anything tappable gets a press state (`className="press"`, `press--wide`, `press--icon`).
- Moves use springs and fades use curves, from `src/motion/motion.ts`. If the designer gave you a
  team motion standard, replace the values in `MOTION` with theirs. Never type ad-hoc
  durations/easings inside components.
- Respect `prefers-reduced-motion`. The helpers already do; keep custom animations consistent.

### 6. Phone check

The shell handles the mockup/full-bleed switch. Your screens still have to behave. In the browser
(preview tools, or Chrome DevTools device mode), check each screen at 360×740, 390×844 and
430×932, plus landscape for app flows:
- no horizontal scroll (`document.scrollingElement.scrollWidth <= innerWidth`);
- nothing hidden under the notch or home bar; bottom bars use `env(safe-area-inset-bottom)`;
- inputs are ≥16px on touch (the base CSS enforces it; don't override it);
- fixed/sticky headers and bottom CTAs stay put while the screen scrolls.

Checklist with fixes: [phone-and-web.md](references/phone-and-web.md).

### 7. Hand off

- Run the production build (`npm run build`) and fix any errors.
- Give the designer: the local URL; the LAN URL (`http://<laptop-ip>:<port>`, since the dev server
  listens on the network) so they can open it on their phone now; and the deploy
  command if they want a public link (`npx vercel` from the project folder, run by them).
- A short report: per screen, the final match result (PASS / mismatch % / known differences),
  which prototype links are wired, and any interaction you had to infer.

## Re-syncing after design changes

Designers iterate. When they send a new link for an existing prototype, work from the **new node
ids** (frames often move to new sections between iterations), re-export the reference images, run
the match loop on every screen to see what changed, and fix only what differs. The match loop
doubles as a change detector.

## Reference files

| File | Read when |
|---|---|
| [building.md](references/building.md) | translating Figma layers to CSS: auto layout, sizing, text, strokes, effects, images, components |
| [match-loop.md](references/match-loop.md) | running compare.mjs, reading its report, cause→fix table, stopping rules |
| [interactions.md](references/interactions.md) | reading prototype links, mapping transitions, overlays, gestures, motion tokens |
| [phone-and-web.md](references/phone-and-web.md) | how the phone shell behaves, responsive web, real-device checks |
