#!/usr/bin/env bash
# tools/land.sh — land an agent's work: apply its patch on a fresh branch, push it,
# and open the pull request. No `gh` CLI needed — plain git + the GitHub REST API.
#
#   tools/land.sh handoff/copilot.patch --title "feat: wall jump" [--branch agent/wall-jump]
#   tools/land.sh agent.bundle --title "fix: dust barrier"   (git bundle also accepted)
#
# Options:
#   --title  "..."   PR title (default: derived from the commit)
#   --body   file    PR description file (default: auto-generated)
#   --branch name    head branch (default: agent/<slug>-<date>)
#   --base   name    target branch (default: $BASE or dev)
#   --dry-run        apply + commit in a temp worktree, do not push or open a PR
#
# The landing happens in a throwaway git worktree, so uncommitted work in this
# checkout is never touched.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_SLUG="${REPO_SLUG:-j00bi/cat-hero-sandbox}"
BASE_BRANCH="${BASE:-dev}"
AGENT_NAME="${AGENT_NAME:-copilot-agent}"
AGENT_EMAIL="${AGENT_EMAIL:-copilot-agent@users.noreply.github.com}"

SRC=""; TITLE=""; BODY_FILE=""; BRANCH=""; DRY_RUN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --title)  TITLE="${2:?--title needs a value}"; shift 2 ;;
    --body)   BODY_FILE="${2:?--body needs a file}"; shift 2 ;;
    --branch) BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    --base)   BASE_BRANCH="${2:?--base needs a value}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 1 ;;
    *)  SRC="$1"; shift ;;
  esac
done

[ -n "$SRC" ] && [ -f "$SRC" ] || {
  echo "usage: tools/land.sh <patch|bundle> [--title ...] [--branch ...] [--dry-run]" >&2
  exit 1
}
SRC="$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")"

# ---------- prerequisites ----------
command -v git >/dev/null || { echo "✗ git missing" >&2; exit 1; }
command -v python3 >/dev/null || { echo "✗ python3 missing" >&2; exit 1; }

git remote get-url origin >/dev/null 2>&1 || { echo "✗ no origin remote in $ROOT" >&2; exit 1; }

echo "▸ fetch origin"
GIT_TERMINAL_PROMPT=0 git fetch -q origin "+refs/heads/*:refs/remotes/origin/*" || true

if ! git rev-parse -q --verify "origin/$BASE_BRANCH" >/dev/null; then
  echo "✗ origin/$BASE_BRANCH does not exist." >&2
  echo "  Create it once from your current mainline, e.g.:" >&2
  echo "    git push origin master:refs/heads/$BASE_BRANCH" >&2
  exit 1
fi

SLUG="$(printf '%s' "${TITLE:-patch}" | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/^[a-z]+(\([^)]*\))?: *//; s/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40)"
[ -n "$SLUG" ] || SLUG="patch"
BRANCH="${BRANCH:-agent/${SLUG}-$(date +%m%d-%H%M)}"

WT="$(mktemp -d)"
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"; }
trap cleanup EXIT

echo "▸ worktree from origin/$BASE_BRANCH → $BRANCH"
git worktree add -q --detach "$WT" "origin/$BASE_BRANCH"
git -C "$WT" checkout -q -b "$BRANCH"

# ---------- apply ----------
echo "▸ apply $(basename "$SRC")"
case "$SRC" in
  *.bundle)
    git -C "$WT" fetch -q "$SRC" "HEAD" 2>/dev/null || git -C "$WT" fetch -q "$SRC" '*:refs/agent/*'
    PICK="$(git -C "$WT" rev-parse FETCH_HEAD 2>/dev/null || true)"
    [ -n "$PICK" ] || { echo "✗ could not read a commit out of the bundle" >&2; exit 1; }
    git -C "$WT" -c user.name="$AGENT_NAME" -c user.email="$AGENT_EMAIL" \
        cherry-pick --no-gpg-sign "$PICK" || {
      echo "✗ cherry-pick conflicted — resolve in: $WT" >&2
      trap - EXIT; exit 1; }
    ;;
  *)
    if git -C "$WT" apply --3way --whitespace=nowarn "$SRC" 2>/dev/null; then
      :
    elif git -C "$WT" apply --3way --whitespace=nowarn --recount "$SRC" 2>/dev/null; then
      :
    elif ( cd "$WT" && patch -p1 --forward --batch < "$SRC" >/dev/null 2>&1 ); then
      :
    else
      echo "✗ patch does not apply to origin/$BASE_BRANCH." >&2
      echo "  Nothing was pushed. The agent's patch was probably made against a" >&2
      echo "  different base — re-pack with tools/pack-for-agent.sh and redo the work." >&2
      trap - EXIT; exit 1
    fi
    git -C "$WT" add -A
    if git -C "$WT" diff --cached --quiet; then
      echo "✗ patch produced no changes." >&2
      trap - EXIT; exit 1
    fi
    COMMIT_TITLE="${TITLE:-$(printf '%s' "$SLUG" | tr '-' ' ')}"
    git -C "$WT" -c user.name="$AGENT_NAME" -c user.email="$AGENT_EMAIL" \
        commit -q --no-gpg-sign -m "$COMMIT_TITLE" \
        -m "Landed from a sandboxed agent via tools/land.sh."
    ;;
esac

echo "▸ changes vs origin/$BASE_BRANCH"
git -C "$WT" --no-pager diff --stat "origin/$BASE_BRANCH"...HEAD | tail -20

if [ "$DRY_RUN" = "1" ]; then
  echo "✓ dry run — branch $BRANCH prepared, nothing pushed"
  trap - EXIT; echo "  worktree kept for inspection: $WT"; exit 0
fi

# ---------- push ----------
echo "▸ push $BRANCH"
if ! GIT_TERMINAL_PROMPT=0 git -C "$WT" push -q -u origin "HEAD:refs/heads/$BRANCH" 2>/tmp/land-push.err; then
  echo "✗ push failed:" >&2; sed -n '1,8p' /tmp/land-push.err >&2
  rm -f /tmp/land-push.err
  echo "  Check: credential.helper (git config --global credential.helper) or SSH access." >&2
  trap - EXIT; exit 1
fi
echo "  ✓ branch pushed"

# ---------- pull request ----------
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ] && [ -f "$HOME/.git-credentials" ]; then
  TOKEN="$(grep -m1 'github.com' "$HOME/.git-credentials" 2>/dev/null \
           | sed -E 's#https?://[^:]+:([^@]+)@.*#\1#')" || true
fi

if [ -z "$TOKEN" ]; then
  echo "! No GitHub token found — branch is pushed, open the PR manually:"
  echo "  https://github.com/$REPO_SLUG/compare/$BASE_BRANCH...$BRANCH?expand=1"
  trap - EXIT; exit 0
fi

PR_TITLE="${TITLE:-$(git -C "$WT" log -1 --pretty=%s)}"
BODY_TMP="$(mktemp)"
if [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
  cat "$BODY_FILE" > "$BODY_TMP"
else
  {
    echo "## What"
    echo
    echo "${PR_TITLE}"
    echo
    echo "## How it was produced"
    echo
    echo "Sandboxed agent work, landed with \`tools/land.sh\` from base \`$BASE_BRANCH\`."
    echo "No push credentials or network access were available to the agent."
    echo
    echo "## Files"
    echo
    git -C "$WT" --no-pager diff --stat "origin/$BASE_BRANCH"...HEAD | tail -30
    echo
    echo "_Testing notes from the agent go here — edit before merging._"
  } > "$BODY_TMP"
fi

echo "▸ open PR $BASE_BRANCH ← $BRANCH"
CODE="$(python3 - "$REPO_SLUG" "$PR_TITLE" "$BRANCH" "$BASE_BRANCH" "$BODY_TMP" "$TOKEN" <<'PY'
import json, sys, urllib.request, urllib.error

slug, title, head, base, body_file, token = sys.argv[1:7]
body = open(body_file, encoding="utf-8").read()
data = json.dumps({"title": title, "head": head, "base": base, "body": body}).encode()
req = urllib.request.Request(
    f"https://api.github.com/repos/{slug}/pulls",
    data=data, method="POST",
    headers={"Authorization": f"Bearer {token}",
             "Accept": "application/vnd.github+json",
             "Content-Type": "application/json",
             "User-Agent": "land-sh"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        out = json.load(r)
        print("CREATED", out.get("html_url"))
except urllib.error.HTTPError as e:
    detail = e.read().decode(errors="replace")
    try:
        msg = json.loads(detail).get("message", detail)
        errs = json.loads(detail).get("errors")
    except Exception:
        msg, errs = detail[:300], None
    if "already exists" in str(msg):
        print("EXISTS")
    else:
        print("FAILED", msg, errs)
PY
)"
rm -f "$BODY_TMP"

case "$CODE" in
  CREATED*) echo "✓ ${CODE#CREATED }" ;;
  EXISTS)
    echo "! A pull request for $BRANCH already exists:"
    echo "  https://github.com/$REPO_SLUG/compare/$BASE_BRANCH...$BRANCH?expand=1" ;;
  *)
    echo "! Branch pushed, PR not created: ${CODE#FAILED }"
    echo "  https://github.com/$REPO_SLUG/compare/$BASE_BRANCH...$BRANCH?expand=1" >&2 ;;
esac
