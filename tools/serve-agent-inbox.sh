#!/usr/bin/env bash
# tools/serve-agent-inbox.sh — publish a pushable git remote over a public HTTPS tunnel,
# so a sandboxed agent with internet egress can clone, commit and push without ever
# holding a GitHub credential.
#
#   tools/serve-agent-inbox.sh              start (or restart) the tunnel, print the URL
#   tools/serve-agent-inbox.sh status       is it up?
#   tools/serve-agent-inbox.sh stop         tear down (revokes access instantly)
#   tools/serve-agent-inbox.sh --refresh    rebuild the inbox from current master
#
# What the agent gets:  https://<random>.trycloudflare.com/cat-hero.git
# What guards it:      HTTP basic auth, random 24-char token, one repo, no shell.
# What it is NOT:      a path to GitHub. Agent pushes to this box; `tools/land-inbox.sh`
#                      turns a branch into a real PR on GitHub.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE="${INBOX_STATE:-$HOME/cat-hero-agent}"
REPO="$STATE/cat-hero.git"
PORT="${INBOX_PORT:-8899}"
CF="$HOME/.local/bin/cloudflared"
mkdir -p "$STATE"
cd "$STATE"

start_gitd() {
  [ -f gitd.pid ] && kill "$(cat gitd.pid)" 2>/dev/null || true
  GITD_PORT="$PORT" nohup python3 "$ROOT/tools/gitd.py" >> gitd.log 2>&1 &
  echo $! > gitd.pid
  sleep 1
  curl -sS -o /dev/null -m 3 "http://127.0.0.1:$PORT/health.txt" || {
    echo "✗ gitd did not come up — see $STATE/gitd.log" >&2; exit 1; }
}

start_tunnel() {
  [ -f cf.pid ] && kill "$(cat cf.pid)" 2>/dev/null || true
  command -v "$CF" >/dev/null || { echo "✗ cloudflared missing at $CF" >&2; exit 1; }
  nohup "$CF" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate --protocol http2 \
    > cf.log 2>&1 &
  echo $! > cf.pid
  local url=""
  for _ in $(seq 1 40); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' cf.log | head -1 || true)"
    [ -n "$url" ] && break
    sleep 1
  done
  [ -n "$url" ] || { echo "✗ tunnel did not register — see $STATE/cf.log" >&2; exit 1; }
  printf '%s\n' "$url" > public-url.txt
}

case "${1:-start}" in
  stop)
    [ -f cf.pid ]   && kill "$(cat cf.pid)" 2>/dev/null   || true
    [ -f gitd.pid ] && kill "$(cat gitd.pid)" 2>/dev/null || true
    rm -f cf.pid gitd.pid public-url.txt
    echo "✓ agent inbox stopped (tunnel gone, token no longer usable)"; exit 0 ;;
  status)
    U="$(cat public-url.txt 2>/dev/null || true)"
    echo "repo:  $REPO ($(du -sh "$REPO" 2>/dev/null | cut -f1 || echo missing))"
    echo "url:   ${U:-not running}"
    if [ -n "$U" ]; then
      curl -sS -m 5 -o /dev/null -w "health: %{http_code}\n" "$U/health.txt" || echo "health: unreachable"
    fi
    exit 0 ;;
esac

if [ "${1:-}" = "--refresh" ] || [ ! -d "$REPO" ]; then
  if [ -d "$REPO" ]; then
    pending="$(git -C "$REPO" for-each-ref --format='%(refname:short)' refs/heads | grep -v '^master$' || true)"
    if [ -n "$pending" ]; then
      echo "! unlanded agent branches still in the inbox — land them first (tools/land-inbox.sh):"
      echo "$pending" | sed 's/^/    /'
      echo "  Re-run with FORCE=1 to discard them."
      [ "${FORCE:-0}" = "1" ] || exit 1
    fi
    rm -rf "$REPO"
  fi
  echo "▸ building source-only inbox repo"
  git clone -q --bare "$ROOT" "$REPO"
  FILTER_BRANCH_SQUELCH_WARNING=1 git -C "$REPO" filter-branch -f --index-filter \
    'git rm -r --cached --ignore-unmatch -q dist shots out reference assets/original handoff' \
    --prune-empty -- --all >/dev/null 2>&1
  rm -rf "$REPO/refs/original"
  git -C "$REPO" reflog expire --expire=now --all
  git -C "$REPO" gc -q --prune=now
  git -C "$REPO" config http.receivepack true
  git -C "$REPO" config http.uploadpack true
  git -C "$REPO" update-server-info
fi

if [ ! -f passwd ]; then
  python3 - "$STATE/passwd" <<'PY'
import secrets, sys, pathlib
p = pathlib.Path(sys.argv[1])
p.write_text("copilot:" + secrets.token_urlsafe(18) + "\n"); p.chmod(0o600)
PY
fi

start_gitd
start_tunnel

U="$(cat public-url.txt)"
IFS=: read -r USER PASS < passwd
HOST="${U#https://}"

echo
echo "✓ agent inbox live"
echo
echo "  clone:  git clone https://$USER:$PASS@$HOST/cat-hero.git"
echo "  url:    $U   ($(du -sh "$REPO" | cut -f1), $(git -C "$REPO" rev-list --count master) commits)"
echo
echo "  reachability probe for the agent:  curl -s $U/health.txt"
echo "  land its work:                     tools/land-inbox.sh <branch> --title \"...\""
echo "  revoke:                            tools/serve-agent-inbox.sh stop"
echo
echo "  ! Anyone with this URL+token can push to the inbox repo. Keep it out of"
echo "    public channels; stopping the tunnel revokes it immediately."
