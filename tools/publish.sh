#!/usr/bin/env bash
# Build the playable bundle and publish it to GitHub Pages.
#
#   tools/publish.sh
#
# Produces dist/cat-hero-itch.zip (for itch.io) and force-pushes the same files
# to the gh-pages branch of j00bi/cat-hero, which serves:
#   https://j00bi.github.io/cat-hero-restyle/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO="j00bi/cat-hero-restyle"
SITE="dist/pkg"

echo "== build $SITE"
rm -rf dist
mkdir -p "$SITE/assets"
cp index.html style.css game.js "$SITE/"
cp assets/cat-atlas.png assets/cat-atlas.json "$SITE/assets/"

echo "== itch zip"
python3 - "$SITE" dist/cat-hero-itch.zip <<'PY'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(src):
        for f in files:
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, src))
PY
ls -lh dist/cat-hero-itch.zip

echo "== publish to $REPO (gh-pages)"
tmp="$(mktemp -d)"
cp -r "$SITE/." "$tmp/"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.email=agent@local -c user.name=agent commit -q -m "deploy: $(date -u '+%Y-%m-%dT%H:%MZ')"
git remote add origin "https://github.com/$REPO.git"
git -c credential.helper='!gh auth git-credential' push -q -f origin gh-pages
cd "$ROOT"
rm -rf "$tmp"

echo "== live: https://j00bi.github.io/cat-hero-restyle/  (give Pages ~30s)"
