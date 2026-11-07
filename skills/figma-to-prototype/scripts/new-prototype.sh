#!/usr/bin/env bash
# Create a prototype project from the template.
#
#   bash new-prototype.sh <dest-dir> <title> <app|web> [frame-w] [frame-h] [status-bar-h] [home-indicator-h]
#
#   bash new-prototype.sh ./checkout-proto "Checkout flow" app 375 812 44 34
#   bash new-prototype.sh ./pricing-page "Pricing page" web 1440 1024
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="${1:?dest dir}"; title="${2:?title}"; mode="${3:?app|web}"
fw="${4:-375}"; fh="${5:-812}"; sh="${6:-44}"; hh="${7:-34}"
[[ "$mode" == app || "$mode" == web ]] || { echo "mode must be app or web"; exit 1; }
[[ -e "$dest" && -n "$(ls -A "$dest" 2>/dev/null)" ]] && { echo "$dest exists and is not empty"; exit 1; }

mkdir -p "$dest"
cp -R "$here/../assets/template/." "$dest/"
# shipped as "gitignore" because package tools strip dotfiles
[[ -f "$dest/gitignore" ]] && mv "$dest/gitignore" "$dest/.gitignore"
name="$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')"

# fill placeholders (BSD/GNU sed compatible)
for f in "$dest/package.json" "$dest/index.html" "$dest/src/config.ts" "$dest/README.md"; do
  sed -i.bak \
    -e "s|__NAME__|$name|g" -e "s|__TITLE__|$title|g" -e "s|__MODE__|$mode|g" \
    -e "s|__FRAME_W__|$fw|g" -e "s|__FRAME_H__|$fh|g" -e "s|__STATUS_H__|$sh|g" -e "s|__HOME_H__|$hh|g" "$f"
  rm -f "$f.bak"
done

# web prototypes don't need the phone shell
if [[ "$mode" == web ]]; then
  rm -rf "$dest/src/shell"
  cat > "$dest/src/App.tsx" <<'TSX'
import { Route, Routes } from 'react-router-dom'
import Home from './screens/Home'

/** One route per Figma page/frame, named after the frame. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}
TSX
  # the sheet lives in the phone overlay in app mode; on web it portals to body
  sed -i.bak -e "s|import { PHONE_OVERLAY_ID } from '../shell/PhoneFrame'|const PHONE_OVERLAY_ID = 'overlay'|" "$dest/src/motion/Sheet.tsx" && rm -f "$dest/src/motion/Sheet.tsx.bak"
  sed -i.bak -e "s|.sheet-layer { position: absolute;|.sheet-layer { position: fixed;|" "$dest/src/motion/Sheet.css" && rm -f "$dest/src/motion/Sheet.css.bak"
fi

cd "$dest"
if ! command -v npm >/dev/null; then
  echo "npm not found — install Node.js 20+ (https://nodejs.org) and run 'npm install' in $dest"; exit 0
fi
npm install --no-audit --no-fund --loglevel=error
git init -q 2>/dev/null || true
echo "Created $dest ($mode, frame ${fw}x${fh}). Start it with: npm run dev"
