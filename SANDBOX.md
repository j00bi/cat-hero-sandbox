# Sandbox

A separate deployment for prototyping mechanics without touching the stable build.

- **Sandbox:** https://j00bi.github.io/cat-hero-sandbox/?dev=1 — boots straight into an empty
  32 px grid stage, no rooms, no enemies, no goal.
- **Stable:** https://j00bi.github.io/cat-hero-restyle/

Same code, two entry URLs. Without `?dev=1` the sandbox behaves exactly like the stable game —
the dev layer is one guarded block, so nothing leaks into normal play.

## Dev tools (`?dev=1`)

The panel sits bottom-left and lists its own keys.

| Key | Does |
|---|---|
| `H` | Toggle hitboxes — player (red), enemies (yellow), boss (magenta), solids (cyan), moving platforms (blue) |
| `G` | God mode — damage can't land |
| `[` / `]` | Time scale down / up, 0.1× to 3× — the single most useful tool for tuning physics |
| `N` | Spawn an enemy 120 px ahead of the player |
| `K` | Kill every enemy in the room |
| `T` | Teleport to the room's goal |
| `L` | Jump to the next room |
| `R` | Reload the sandbox room (resets everything) |
| `` ` `` | Hide the overlay (tools stay active) |

The overlay also shows live `anim #frame`, `vy`, `pos` and `ground`, which is how you tell a
physics bug from an animation bug.

## Adding a mechanic

The sandbox stage is a normal level entry with `sandbox: true` and `grid: true` at the end of
`LEVELS` — it has a floor, an empty grid and no goal, so nothing to clear or complete. Add
solids to it `rect(x, y, w, h)` to build test geometry.

Everything is data plus one update loop, so a mechanic usually touches three places:

1. **Constants** — top of `game.js` (`GRAV`, `JUMP_V`, `MOVE`, …). Add yours beside them.
2. **`update(dt)`** — the only place state advances. Apply the rule here; keep it pure so the
   suites can drive it deterministically.
3. **`drawPlayer()` / `draw*`** — read state, never mutate it.

Then, before you believe it works:

```bash
node tools/test.mjs        # 14 gameplay assertions
node tools/reach.mjs       # every platform still reachable
node tools/playthrough.mjs # autopilot clears all 6 rooms
node tools/mobile.mjs      # touch path still works
node tools/boss.mjs        # the Dust King still works
node tools/design.mjs      # HUD stays out of the play band
```

`tools/playthrough.mjs` is the one that catches mechanics that accidentally make a room
unfair — if a dumb bot holding right can't finish, a player will hit the same wall.

## Physics sandbox ideas, cheapest first

| Idea | Where | Cost |
|---|---|---|
| Coyote/jump-buffer tuning | constants only | minutes, use `[` `]` to feel it |
| Variable gravity per room | add `gravity` to a level entry | small |
| Spring pads | new solid flag + bounce in `movePlayer` | small |
| Wall cling / wall jump | `movePlayer` + new anims (we already generated `cling` once) | medium |
| Double jump | player field + jump branch | small |
| Moving-hazard enemies | extend the enemy object with a type field | medium |

## Deploying a change

```bash
tools/publish.sh     # rebuilds the zip and pushes to gh-pages
```

Pages takes ~30 s. Add a cache-buster (`game.js?v=N`) in `index.html` if a change doesn't show
up — the browser will happily serve yesterday's build.
