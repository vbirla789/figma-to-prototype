#!/usr/bin/env node
/**
 * compare.mjs — measure how closely a built screen matches its Figma frame.
 *
 *   node tools/compare.mjs --route /cart --figma .compare/cart/figma.png --width 375
 *
 * Renders the route at the Figma frame's size (and pixel density) with
 * animations off, diffs it against the Figma export, and reports:
 *   - PASS/FAIL (no actionable regions) and the mismatch score (% of pixels that differ)
 *   - the first row (y, in Figma px) where the build diverges from the design
 *   - the biggest mismatch regions, each with a diagnosis:
 *       "offset dx/dy" → the same content sits a few px off (padding, gap,
 *                        line-height, an element above it is the wrong height)
 *       "content"      → it looks different (colour, radius, weight, size,
 *                        border, icon, missing/extra element)
 *       "noise"        → faint text-rasterisation edges; not a real difference
 *   - offset groups: several regions shifted by the same amount = one cause above them
 *   - fonts the page asks for that the browser can't find
 *   - crops: region-N.png = [Figma | build | diff] for each region, overview.png
 *
 * Options
 *   --figma <png>      Figma export of the frame (required). Any scale; the
 *                      density is inferred from png width / --width.
 *   --width <px>       the Figma frame width in px (required)
 *   --route <path>     route to render (default /)
 *   --base <url>       dev server (default http://localhost:5173)
 *   --capture <mode>   full   = frame includes status bar + home indicator (default)
 *                      screen = frame is content only
 *                      none   = web page, no phone shell
 *   --out <dir>        where to write results (default .compare/<route-slug>)
 *   --eval <js>        JS to run in the page before capture (open a sheet, fill a field…)
 *   --wait <ms>        extra settle time before capture (default 300)
 *   --pass <percent>   max overall mismatch % (default 1). A screen passes only when
 *                      it is under this AND no region is an offset or content diff.
 *   --threshold <0-1>  per-pixel colour tolerance (default 0.05 — catches near-miss hex values)
 */
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright-core'

// ---------- args ----------
const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) {
    const next = process.argv[i + 1]
    args[a.slice(2)] = next && !next.startsWith('--') ? (i++, next) : true
  }
}
if (!args.figma || !args.width) {
  console.error('usage: node tools/compare.mjs --figma <png> --width <frame px> [--route /path] [--capture full|screen|none]')
  process.exit(2)
}
const route = args.route || '/'
const base = (args.base || 'http://localhost:5173').replace(/\/$/, '')
const capture = args.capture || 'full'
const frameW = Number(args.width)
const pass = Number(args.pass ?? 1)
const threshold = Number(args.threshold ?? 0.05)
const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
const out = args.out || path.join('.compare', slug)
fs.mkdirSync(out, { recursive: true })

// ---------- figma image ----------
const figma = PNG.sync.read(fs.readFileSync(args.figma))
const scale = Math.round((figma.width / frameW) * 100) / 100
const frameH = Math.round(figma.height / scale)

// ---------- render the build ----------
async function launch() {
  const tries = [
    () => chromium.launch({ channel: 'chrome' }),
    () => chromium.launch({ channel: 'msedge' }),
    () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  ]
  for (const t of tries) {
    try {
      return await t()
    } catch {}
  }
  console.error('Could not start a browser. Install Google Chrome, or run: npx playwright install chromium')
  process.exit(2)
}

const browser = await launch()
const page = await browser.newPage({
  viewport: { width: frameW, height: frameH },
  deviceScaleFactor: scale,
  reducedMotion: 'reduce',
})
const url = new URL(base + route)
if (capture !== 'none') url.searchParams.set('capture', capture === 'full' ? '' : capture)
await page.goto(url.toString(), { waitUntil: 'networkidle' })
await page.addStyleTag({
  content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
})
if (args.eval) await page.evaluate(args.eval)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(Number(args.wait ?? 300))

// fonts the CSS asks for that the browser can't render (falls back silently otherwise)
const missingFonts = await page.evaluate(() => {
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit', 'initial'])
  const fams = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const first = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
    if (first && !generic.has(first.toLowerCase())) fams.add(first)
  }
  const c = document.createElement('canvas').getContext('2d')
  const sample = 'mmmmmmmmmmlli1WQ@#0123456789abcdefghijklmnopqrstuvwxyz'
  const width = (f) => ((c.font = `72px ${f}`), c.measureText(sample).width)
  return [...fams].filter((f) => ['monospace', 'serif', 'sans-serif'].every((g) => width(`"${f}", ${g}`) === width(g)))
})

const shot = PNG.sync.read(await page.screenshot({ type: 'png' }))
await browser.close()

// ---------- diff ----------
const W = Math.min(figma.width, shot.width)
const H = Math.min(figma.height, shot.height)
const crop = (img, x, y, w, h) => {
  const o = new PNG({ width: w, height: h })
  for (let r = 0; r < h; r++) img.data.copy(o.data, r * w * 4, ((y + r) * img.width + x) * 4, ((y + r) * img.width + x + w) * 4)
  return o
}
const A = crop(figma, 0, 0, W, H)
const B = crop(shot, 0, 0, W, H)
const mask = new PNG({ width: W, height: H })
const pretty = new PNG({ width: W, height: H })
const opts = { threshold, includeAA: false }
const mismatched = pixelmatch(A.data, B.data, mask.data, W, H, { ...opts, alpha: 0, diffColor: [255, 0, 0], aaColor: [255, 255, 255] })
pixelmatch(A.data, B.data, pretty.data, W, H, { ...opts, alpha: 0.15 })
const score = (mismatched / (W * H)) * 100
const isDiff = (x, y) => {
  const i = (y * W + x) * 4
  return mask.data[i] === 255 && mask.data[i + 1] === 0 && mask.data[i + 2] === 0
}

// first divergent row (in Figma px)
let firstDivergence = null
for (let y = 0; y < H && firstDivergence === null; y++) {
  let n = 0
  for (let x = 0; x < W; x++) if (isDiff(x, y)) n++
  if (n > Math.max(2, W * 0.004)) firstDivergence = Math.floor(y / scale)
}

// regions: 8px cells over 2% mismatched, joined to touching neighbours into boxes
const cell = Math.max(1, Math.round(8 * scale))
const cols = Math.ceil(W / cell)
const rows = Math.ceil(H / cell)
const hot = new Uint8Array(cols * rows)
const count = new Uint32Array(cols * rows)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isDiff(x, y)) count[Math.floor(y / cell) * cols + Math.floor(x / cell)]++
for (let i = 0; i < hot.length; i++) hot[i] = count[i] > cell * cell * 0.02 ? 1 : 0
const seen = new Uint8Array(cols * rows)
const regions = []
for (let i = 0; i < hot.length; i++) {
  if (!hot[i] || seen[i]) continue
  const stack = [i]
  seen[i] = 1
  let x0 = cols, y0 = rows, x1 = 0, y1 = 0, px = 0
  while (stack.length) {
    const j = stack.pop()
    const cx = j % cols, cy = Math.floor(j / cols)
    x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy)
    px += count[j]
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const k = ny * cols + nx
        if (hot[k] && !seen[k]) { seen[k] = 1; stack.push(k) }
      }
  }
  regions.push({ x: x0 * cell, y: y0 * cell, w: Math.min(W, (x1 + 1) * cell) - x0 * cell, h: Math.min(H, (y1 + 1) * cell) - y0 * cell, px })
}
regions.sort((a, b) => b.px - a.px)

// grayscale at 1x for the offset search
const gray = (img) => {
  const w = Math.floor(W / scale), h = Math.floor(H / scale)
  const g = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (Math.floor(y * scale) * img.width + Math.floor(x * scale)) * 4
      g[y * w + x] = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114
    }
  return { g, w, h }
}
const GA = gray(A), GB = gray(B)
const err = (x, y, w, h, dx, dy) => {
  let s = 0, n = 0
  for (let yy = y; yy < y + h; yy += 1)
    for (let xx = x; xx < x + w; xx += 1) {
      const bx = xx + dx, by = yy + dy
      if (bx < 0 || by < 0 || bx >= GB.w || by >= GB.h) continue
      s += Math.abs(GA.g[yy * GA.w + xx] - GB.g[by * GB.w + bx]); n++
    }
  return n ? s / n : Infinity
}
function diagnose(r) {
  const x = Math.floor(r.x / scale), y = Math.floor(r.y / scale)
  const w = Math.min(Math.ceil(r.w / scale), 600), h = Math.min(Math.ceil(r.h / scale), 600)
  const base0 = err(x, y, w, h, 0, 0)
  let best = { dx: 0, dy: 0, e: base0 }
  for (let dy = -16; dy <= 16; dy++) { const e = err(x, y, w, h, 0, dy); if (e < best.e) best = { dx: 0, dy, e } }
  for (let dx = -16; dx <= 16; dx++) { const e = err(x, y, w, h, dx, best.dy); if (e < best.e) best = { dx, dy: best.dy, e } }
  for (let dy = best.dy - 2; dy <= best.dy + 2; dy++)
    for (let dx = best.dx - 2; dx <= best.dx + 2; dx++) { const e = err(x, y, w, h, dx, dy); if (e < best.e) best = { dx, dy, e } }
  // a real offset: shifting makes the region (nearly) line up. A partial
  // improvement means the shapes differ (e.g. a corner radius), not the position.
  const offset = (best.dx || best.dy) && best.e < Math.max(4, base0 * 0.25)
  if (offset) return { kind: 'offset', dx: best.dx, dy: best.dy, note: `build content sits ${describe(best.dx, best.dy)} than in the design` }
  // Figma and the browser rasterise text slightly differently, so text that is
  // right still leaves a faint outline of mismatched pixels. A low average
  // difference over the region means that's all this is.
  if (base0 < 4) return { kind: 'noise', note: 'faint edge differences only (text rasterisation) — ignore unless it looks wrong in the crop' }
  return { kind: 'content', note: 'same place, looks different (colour / size / weight / radius / border / icon / missing or extra element)' }
}
function describe(dx, dy) {
  const p = []
  if (dy) p.push(`${Math.abs(dy)}px ${dy > 0 ? 'lower' : 'higher'}`)
  if (dx) p.push(`${Math.abs(dx)}px ${dx > 0 ? 'right' : 'left'}`)
  return p.join(' and ')
}

// ---------- write crops + report ----------
const strip = (parts, gap = Math.round(4 * scale)) => {
  const w = parts.reduce((s, p) => s + p.width, 0) + gap * (parts.length - 1)
  const h = Math.max(...parts.map((p) => p.height))
  const o = new PNG({ width: w, height: h })
  o.data.fill(255) // white gutters
  let ox = 0
  for (const p of parts) {
    for (let r = 0; r < p.height; r++) p.data.copy(o.data, (r * w + ox) * 4, r * p.width * 4, (r + 1) * p.width * 4)
    ox += p.width + gap
  }
  return o
}
fs.writeFileSync(path.join(out, 'build.png'), PNG.sync.write(B))
fs.writeFileSync(path.join(out, 'diff.png'), PNG.sync.write(pretty))
fs.writeFileSync(path.join(out, 'overview.png'), PNG.sync.write(strip([A, B, pretty])))

const top = regions.slice(0, 12).sort((a, b) => a.y - b.y || a.x - b.x).map((r, i) => {
  const pad = Math.round(16 * scale)
  const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad)
  const w = Math.min(W - x, r.w + pad * 2), h = Math.min(H - y, r.h + pad * 2)
  const file = path.join(out, `region-${i + 1}.png`)
  fs.writeFileSync(file, PNG.sync.write(strip([crop(A, x, y, w, h), crop(B, x, y, w, h), crop(pretty, x, y, w, h)])))
  return {
    n: i + 1,
    box: { x: Math.round(r.x / scale), y: Math.round(r.y / scale), w: Math.round(r.w / scale), h: Math.round(r.h / scale) },
    mismatchPx: Math.round(r.px / (scale * scale)),
    ...diagnose(r),
    crop: file,
  }
})

// regions that share one offset usually have one cause: an element above them
// is the wrong height, or a container has the wrong padding/gap
const groups = {}
for (const r of top.filter((r) => r.kind === 'offset')) (groups[`${r.dx},${r.dy}`] ??= []).push(r)
const offsetGroups = Object.values(groups)
  .filter((g) => g.length > 1)
  .map((g) => ({
    dx: g[0].dx,
    dy: g[0].dy,
    regions: g.map((r) => r.n),
    note: `${g.length} regions all ${describe(g[0].dx, g[0].dy)} → look for ONE cause at or above y=${Math.min(...g.map((r) => r.box.y))}px (padding, gap, line-height, an element's height)`,
  }))
const actionable = top.filter((r) => r.kind !== 'noise')

const sizeNote =
  figma.width !== shot.width || figma.height !== shot.height
    ? `size differs: figma ${figma.width}x${figma.height}, build ${shot.width}x${shot.height}`
    : null
const report = {
  route,
  frame: { width: frameW, height: frameH, scale },
  mismatchPercent: Math.round(score * 100) / 100,
  pass: actionable.length === 0 && score <= pass,
  firstDivergenceY: firstDivergence,
  missingFonts,
  sizeNote,
  offsetGroups,
  regions: top,
  files: { overview: path.join(out, 'overview.png'), build: path.join(out, 'build.png'), diff: path.join(out, 'diff.png') },
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2))

console.log(`\n${report.pass ? 'PASS' : 'FAIL'}  ${route}  mismatch ${report.mismatchPercent}%  ${actionable.length} region(s) to fix  frame ${frameW}x${frameH} @${scale}x`)
if (missingFonts.length) console.log(`  ! fonts not available: ${missingFonts.join(', ')} — fix these first, they shift everything`)
if (sizeNote) console.log(`  ! ${sizeNote}`)
if (firstDivergence !== null) console.log(`  first divergence at y=${firstDivergence}px — fix from the top down; offsets cascade`)
for (const g of offsetGroups) console.log(`  ⇢ ${g.note}`)
for (const r of top) console.log(`  #${r.n}  x${r.box.x} y${r.box.y} ${r.box.w}x${r.box.h}  ${r.kind}: ${r.note}  → ${r.crop}`)
if (regions.length > top.length) console.log(`  …and ${regions.length - top.length} smaller regions`)
console.log(`  overview: ${report.files.overview}\n`)
