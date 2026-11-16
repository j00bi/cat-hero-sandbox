#!/usr/bin/env bash
# tools/land-inbox.sh — turn a branch the agent pushed to the inbox repo into a real
# pull request on GitHub. This is the bridge between the public tunnel and the repo.
#
#   tools/land-inbox.sh agent/wall-jump --title "feat: wall jump"
#   tools/land-inbox.sh agent/wall-jump --dry-run
#
# Everything after the branch name is passed straight to tools/land.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INBOX="${INBOX:-$HOME/cat-hero-agent/cat-hero.git}"
BASE="${INBOX_BASE:-master}"

BRANCH="${1:-}"; shift || true
[ -n "$BRANCH" ] || { echo "usage: tools/land-inbox.sh <branch> [land.sh options]" >&2; exit 1; }
[ -d "$INBOX" ] || { echo "✗ inbox repo not found: $INBOX (run tools/serve-agent-inbox.sh)" >&2; exit 1; }

git -C "$INBOX" rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null || {
  echo "✗ branch '$BRANCH' is not in the inbox. Available:" >&2
  git -C "$INBOX" for-each-ref --format='    %(refname:short)  %(committerdate:relative)' refs/heads | grep -v 'master' >&2 || true
  exit 1
}

MB="$(git -C "$INBOX" merge-base "$BASE" "$BRANCH")"
PATCH="$(mktemp -t inbox-XXXXXX.patch)"
trap 'rm -f "$PATCH"' EXIT

git -C "$INBOX" --no-pager diff --binary "$MB".."$BRANCH" > "$PATCH"
if [ ! -s "$PATCH" ]; then
  echo "✗ '$BRANCH' has no changes against $BASE" >&2; exit 1
fi

echo "▸ inbox branch $BRANCH: $(git -C "$INBOX" rev-list --count "$MB".."$BRANCH") commit(s), $(wc -l < "$PATCH") diff lines"
git -C "$INBOX" --no-pager diff --stat "$MB".."$BRANCH" | tail -15

exec "$ROOT/tools/land.sh" "$PATCH" "$@"
