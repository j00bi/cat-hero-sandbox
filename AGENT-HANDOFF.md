# Agent handoff — letting a network-less sandbox develop CAT HERO

A sandboxed agent (M365 Copilot, a chat model, anything that can read uploaded files
but cannot reach GitHub) can do real work on this game. It just cannot *land* it.
This kit closes that gap. Your machine stays the only thing holding credentials.

```
  ┌─ this machine ──────────────┐        ┌─ agent sandbox ─────────┐
  │ tools/pack-for-agent.sh     │  zip → │ edits, tests, git diff  │
  │   handoff/src-<sha>.zip     │        │   → cat-hero.patch      │
  │ tools/land.sh  ←────────────┼──────  └─────────────────────────┘
  │   branch · commit · push · PR│
  └──────────────────────────────┘
```

Nothing is published or merged without you running `land.sh`, and `land.sh` never
force-pushes and never touches your working tree.

## One-time setup

```bash
cd ~/projects/cat-hero-sandbox

# The GitHub repos only carry gh-pages (built output). Development needs a real
# branch to merge into, and a shared ancestor for PRs:
git push origin master:refs/heads/dev

# Authentication for push lives in ~/.git-credentials (helper = store).
git config --global credential.helper store   # already set on this machine
```

`gh` is **not** required anywhere in this workflow. Pull requests are created
through the REST API with `curl`/`python3`, which is installed everywhere.

## The loop

**1 — Pack the source.** Produces a source-only zip (~2.5 MB): no `dist/`, no
`shots/`, no `.git`, no PSD originals.

```bash
tools/pack-for-agent.sh
# ✓ handoff/cat-hero-src-<sha>.zip
# ✓ handoff/PROMPT.txt
```

**2 — Hand it over.** Upload `handoff/PROMPT.txt` + the zip to the agent, filling in
the task. The prompt tells it to work from the pristine copy, avoid restructuring,
and return a unified diff.

**3 — Land what comes back.** Save the `.patch` into `handoff/`, then:

```bash
tools/land.sh handoff/cat-hero.patch \
  --title "feat: wall jump on dust walls" \
  --body handoff/testing-notes.md          # optional
```

That is the whole interface. `land.sh` will:

1. fetch `origin`, build a throwaway worktree from `dev` (your checkout is untouched);
2. apply the patch (`--3way`, then `patch -p1` fallback) and fail loudly if it does not fit;
3. commit as `copilot-agent`;
4. push `agent/<slug>-<date>`;
5. open the PR against `dev` and print its URL.

Preview without pushing:

```bash
tools/land.sh handoff/cat-hero.patch --dry-run
```

## Guardrails

- **Base mismatch is the main failure mode.** If the agent's patch was built against
  an older base, `land.sh` refuses and pushes nothing. Re-pack and redo — do not
  hand-resolve blind.
- **Review the diff before merging.** An agent that cannot run the game has not run
  the game; treat its testing notes as claims, not evidence. `tools/test.mjs`,
  `tools/playthrough.mjs` and `tools/reach.mjs` are the real gate.
- **Token hygiene.** `land.sh` reads `GH_TOKEN`, else parses the github entry of
  `~/.git-credentials`. It never prints the token. Do not paste tokens into an agent
  chat — that is the one step this design deliberately avoids.
- **`publish.sh` is separate.** It builds `dist/`, zips for itch and force-pushes
  `gh-pages`. Merging to `dev` does not deploy; run `tools/publish.sh` when you want
  the live site updated.
