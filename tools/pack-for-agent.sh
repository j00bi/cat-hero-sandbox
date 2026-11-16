#!/usr/bin/env bash
# tools/pack-for-agent.sh — build a source-only zip you can hand to a sandboxed agent
# (M365 Copilot, a chat model, anything that can read uploaded files but has no network).
#
#   tools/pack-for-agent.sh              → handoff/cat-hero-src-<sha>.zip
#
# The zip is the SOURCE, not the build: no dist/, no shots/, no out/, no .git,
# no PSD/AI originals. Small enough to upload, complete enough to actually run the
# game with `python3 -m http.server`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
BASE="${BASE:-dev}"
OUTDIR="handoff"
ZIP="$OUTDIR/cat-hero-src-$SHA.zip"
mkdir -p "$OUTDIR"

# Files the agent needs to read, understand and modify the game.
INCLUDE=(
  index.html style.css
  game.js ray.js
  assets spec tools
  README.md DESIGN.md CHECKLIST.md SANDBOX.md REFERENCES.md ART-PIPELINE.md
  CHARACTER.md CHARACTER-GEN.md
  BRIEF-FOR-AI.md BRIEF-FOR-AI-v2.md BRIEF-FOR-AI-v3-feedback.md
)

python3 - "$ZIP" "$SHA" "$BASE" "$ROOT" "${INCLUDE[@]}" <<'PY'
import hashlib, json, os, sys, zipfile

zip_path, sha, base, root = sys.argv[1:5]
include = sys.argv[5:]

# never ship these, even if they sit inside an included dir
SKIP_DIRS = {".git", "dist", "shots", "out", "reference", "__pycache__", "node_modules", "handoff"}
SKIP_DIRS |= {os.path.join("assets", "original")}
SKIP_NAMES = {".DS_Store", "contact.png"}
SKIP_EXT = {".psd", ".aseprite", ".xcf", ".ai", ".zip"}

added = 0
manifest = {}
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for entry in include:
        p = os.path.join(root, entry)
        if not os.path.exists(p):
            continue
        if os.path.isfile(p):
            z.write(p, entry); added += 1
            manifest[entry] = hashlib.sha256(open(p, "rb").read()).hexdigest()
            continue
        for d, dirs, files in os.walk(p):
            rel_d = os.path.relpath(d, root)
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS
                       and os.path.join(rel_d, x) not in SKIP_DIRS]
            for f in files:
                if f in SKIP_NAMES or os.path.splitext(f)[1].lower() in SKIP_EXT:
                    continue
                full = os.path.join(d, f)
                if not os.path.isfile(full):
                    continue
                rel = os.path.relpath(full, root)
                z.write(full, rel); added += 1
                manifest[rel] = hashlib.sha256(open(full, "rb").read()).hexdigest()
    z.writestr("MANIFEST.json", json.dumps(
        {"base": sha, "branch": base, "files": manifest}, indent=1, sort_keys=True))
    z.writestr("BASE.json", json.dumps({"sha": sha, "branch": base}))

print(f"files: {added}")
PY

SIZE="$(du -h "$ZIP" | cut -f1)"

cat > "$OUTDIR/PROMPT.txt" <<EOF
Paste the block below into the sandboxed agent, together with $ZIP.
Base commit: $SHA   Target branch on GitHub: $BASE

---8<--- copy from here ---
You are working on CAT HERO, a dependency-free HTML5/Canvas platformer.
The attached zip is the complete source at git commit $SHA.
Run it with: python3 -m http.server 8891  (open http://127.0.0.1:8891)

Task: <DESCRIBE THE FEATURE OR BUG HERE>

Rules that make your work landable:
1. Read index.html, game.js, style.css first; assets/ holds the sprite atlas.
2. Change only files that exist in the zip. Do not restructure the project,
   do not add dependencies, do not reformat untouched files.
3. Test by loading the page; note what you verified.
4. Deliver a UNIFIED DIFF against the pristine copy you were given:
       git init -q && git add -A && git commit -qm base
       <make your edits>
       git diff > cat-hero.patch
   Also acceptable: the full contents of each file you changed.
5. In your reply include: the .patch (or the changed files), a PR title,
   a short PR description, and your testing notes.
---8<--- to here ---
EOF

echo "✓ $ZIP  ($SIZE)"
echo "✓ $OUTDIR/PROMPT.txt  (upload instructions + agent prompt)"
echo
echo "Next: upload the zip to the agent, get back a .patch, then:"
echo "  tools/land.sh handoff/<returned>.patch --title \"feat: ...\""
