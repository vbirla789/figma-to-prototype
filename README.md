# Figma → Prototype

A skill for Claude Code (and other coding agents) that turns a **Figma link** into a working
prototype that matches the design **1:1**, behaves properly **on a real phone**, and has real
**navigation and motion**.

## Install

```bash
npx skills@latest add vbirla789/figma-to-prototype
```

Add `-g` to install it for all your projects. The CLI needs Node.js 22.20+.

You also need:
- the **Figma MCP server** connected to your agent;
- **Google Chrome** (the match loop renders screens in it; `npx playwright install chromium` works too).

## Use

Paste a link and ask for a prototype:

> Build this as a prototype: https://www.figma.com/design/…?node-id=…

The agent confirms the screen order if the link has several frames, then builds, measures and fixes
each screen, and hands you a local link, a link for your phone on the same Wi-Fi, and a per-screen
match report.

## What it does differently

**It measures the last 15%.** Plain design-to-code gets close, but padding, dividers, line-heights
and radii drift. Every screen is rendered at the Figma frame's exact size and diffed against the
Figma export. The report says what's off and by how much ("7 regions all 4px lower → one cause
above y=64", "this corner looks different"), with side-by-side crops. The agent fixes the cause
and re-checks until the screen passes, without nudging pixels.

**It's right on a phone.** App flows sit in a phone mockup on a laptop. On a real phone the
mockup disappears: no fake status bar or home indicator, no padding, safe areas respected, browser
bars coloured to match each screen, fluid from 360 to 430 wide.

**It moves like an app.** Figma prototype links become screen transitions (push, back, modal,
fade), overlays become bottom sheets with drag-to-dismiss, everything tappable has a press state,
and motion runs on springs. Your team has its own motion standard? Swap the values in one file.

## What's inside

```
skills/figma-to-prototype/
  SKILL.md                  the workflow the agent follows
  references/
    building.md             Figma → CSS: auto layout, text, strokes, dividers, effects, images
    match-loop.md           the pixel-diff loop, reading its report, cause → fix table
    interactions.md         prototype links, overlays, gestures, motion tokens
    phone-and-web.md        phone shell behaviour, responsive web, device checks
  scripts/new-prototype.sh  scaffolds a project from the template
  assets/template/          React + Vite starter: phone shell, motion, sheet, compare tool
```

## License

MIT
