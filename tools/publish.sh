#!/usr/bin/env bash
# tools/publish.sh — build dist/, verify every runtime asset, zip for itch, push gh-pages.
#   tools/publish.sh            build + verify + zip + deploy
#   DRY_RUN=1 tools/publish.sh  build + verify + zip only (no push)
#   REPO=j00bi/cat-hero-restyle tools/publish.sh   (stable fork)
set -euo pipefail

REPO="${REPO:-j00bi/cat-hero-sandbox}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SITE="dist/pkg"
VER="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
OWNER="${REPO%%/*}"; NAME="${REPO##*/}"
URL="https://${OWNER}.github.io/${NAME}"

echo "▸ build $VER → $SITE"
rm -rf dist && mkdir -p "$SITE"

# 1. code: index, css, EVERY top-level .js (game.js, ray.js, …)
cp index.html style.css "$SITE/"
cp ./*.js "$SITE/"

# 2. assets: the whole runtime tree (atlas, fx/, icons/, story/, …) minus source-only folders
mkdir -p "$SITE/assets"
( cd assets && find . -type f \
    ! -path './original/*' ! -name '*.psd' ! -name '*.aseprite' ! -name '*.xcf' ! -name '.DS_Store' \
    -exec cp --parents {} "../$SITE/assets/" \; )

# 3. cache-bust every local .js/.css reference in index.html
sed -E -i "s#(src|href)=\"([^\":?]+\.(js|css))(\?v=[^\"]*)?\"#\1=\"\2?v=${VER}\"#g" "$SITE/index.html"

# 4. verify: every assets/… path referenced in code must exist in the bundle.
#    Template paths like `assets/icons/power${i}.png` are checked as globs (power*.png).
echo "▸ verify asset references"
missing=0; checked=0
while IFS= read -r ref; do
  checked=$((checked+1))
  pat="$(printf '%s' "$ref" | sed -E 's/\$\{[^}]*\}/*/g')"
  if ! compgen -G "$SITE/$pat" > /dev/null; then
    echo "  ✗ MISSING  $ref"; missing=$((missing+1))
  fi
done < <(grep -ohE "[\"'\`]assets/[^\"'\`?#)]+" "$SITE"/*.js "$SITE/index.html" "$SITE/style.css" \
          | cut -c2- | sort -u)
for dir in fx icons; do                      # the two folders that went missing before
  if [ -d "assets/$dir" ] && [ -z "$(ls -A "$SITE/assets/$dir" 2>/dev/null)" ]; then
    echo "  ✗ EMPTY    assets/$dir"; missing=$((missing+1))
  fi
done
if [ "$missing" -gt 0 ]; then echo "✗ $missing missing asset(s) — aborting"; exit 1; fi
echo "  ✓ $checked references OK"
echo "  bundle: $(find "$SITE" -type f | wc -l) files, $(du -sh "$SITE" | cut -f1)"

# 5. itch zip (index.html at the zip root)
echo "▸ zip dist/cat-hero-itch.zip"
if command -v zip >/dev/null; then
  ( cd "$SITE" && zip -qr ../cat-hero-itch.zip . )
else
  python3 - "$SITE" dist/cat-hero-itch.zip <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk(src):
        for f in fs:
            p = os.path.join(d, f); z.write(p, os.path.relpath(p, src))
PY
fi

if [ "${DRY_RUN:-0}" = "1" ]; then echo "✓ dry run done (no push)"; exit 0; fi

# 6. deploy gh-pages (orphan commit, force push)
echo "▸ push gh-pages → $REPO"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp -r "$SITE"/. "$TMP"/ && touch "$TMP/.nojekyll"
git -C "$TMP" init -q -b gh-pages
git -C "$TMP" add -A
git -C "$TMP" -c user.name="publish" -c user.email="publish@localhost" commit -qm "deploy $VER"
# Credentials: use the ambient helper (~/.git-credentials, or GIT_CRED_HELPER to
# override). This used to hardcode `!gh auth git-credential`, which broke every
# machine without the GitHub CLI — including this one.
git -C "$TMP" ${GIT_CRED_HELPER:+-c credential.helper="$GIT_CRED_HELPER"} \
  push -qf "https://github.com/${REPO}.git" gh-pages

# 7. smoke test the live site (Pages can take ~1 min; non-fatal)
echo "▸ smoke test $URL"
for p in "index.html" "assets/fx/lightning-charge.json" "assets/icons/power0.png" "ray.js"; do
  [ -e "$SITE/$p" ] || continue
  ok=0
  for _ in 1 2 3 4 5 6; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$URL/$p?v=$VER" || true)"
    [ "$code" = "200" ] && { ok=1; break; }; sleep 10
  done
  [ $ok = 1 ] && echo "  ✓ $p" || echo "  ! $p not live yet (HTTP $code) — recheck in a minute"
done
echo "✓ deployed $VER → $URL"
