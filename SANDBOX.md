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

## Icons from the sprite atlas

Power icons in the HUD are 16×16 sprites pulled from `/home/husni/sprite-atlas` (1.4M CC0
sprites, indexed in `atlas.db`):

```bash
cd /home/husni/sprite-atlas
python3 pick_icon.py "ice crystal"     out/ice.png    --want blue
python3 pick_icon.py "lightning bolt"  out/bolt.png   --want cyan
python3 pick_icon.py "flame"           out/fire.png   --want warm
```

Copy the PNGs into `assets/icons/` and they are picked up by `powerIcons` in `game.js`.
The `--want` flag scores the mean colour of the opaque pixels, so you can ask for a blue
lightning bolt instead of the first yellow one.

## Charge FX (pixelfx)

`assets/fx/lightning-charge.png` + `.json` is `pixelfx`'s **lightning/charge-up**, exported
actor-free and cropped to its ink:

```bash
node tools/export-fx.mjs lightning/charge-up /tmp/chargeup   # full-size strip + meta
# then crop/install (see git history) -> assets/fx/lightning-charge.{png,json}
```

- **82 frames @ 30 fps**, cropped to 225×157, `burstStart: 48` (the blast at t=1.6 s)
- **build** (frames 0–47) is driven by the **charge meter**, not time — frame
  `floor(charge/100 * 47)`
- **burst** (frames 48–81) plays once when a cast succeeds
- drawn **behind** the cat at native scale, pivot on the chest, so the cat stays readable
- if the sheet fails to load, the hand-drawn arcs in `drawPowerFx()` are the fallback

## Charge → superpower (first slice)

The cat builds a charge meter and spends it on a power.

- **Charge:** **hold `C`** — the cat crouches and the meter fills at 95/s (full in ~1.1 s).
  Moving or leaving the ground cancels the crouch and keeps whatever charge you banked.
  Stomping an enemy adds **+28** instantly and collecting a fish **+7**, so fighting is the
  fast way to charge and holding still is the slow way.
- **Spend:** **release `C`** while the meter is full to cast the selected power. Charge resets.
- **Select:** `V` cycles; in dev `1` `2` `3` pick directly. The current power is named under
  the meter.

| Power | Effect | Ring |
|---|---|---|
| **Thunder Pounce** | 0.42 s lunge at 760 px/s, invulnerable, kills what it passes through, +1 hit on a stunned Dust King | cyan arcs + afterimage |
| **Frost Nova** | freezes every enemy for 3 s (they stop moving, tinted ice, still harmful on touch) | cyan |
| **Ember Burst** | 230 px radial kill, also hits a stunned Dust King | gold + fire particles |
- **Tell:** the crouch pose is held for exactly as long as the key is down (single frame, no
  flicker); the meter pulses when full; each power has its own ring and particles.
- **Tuning:** `state.chargeMax`, the `addCharge(28)` / `addCharge(7)` calls, and
  `p.power = 0.42` / `p.vx = p.facing * 760` in `updatePower`.

In the sandbox press **`F`** to fill the meter instantly, then **`C`**.

### Where the next powers plug in

`tryPower()` is the single entry point. Give it a `state.powerId` and branch:

| Power | Effect | VFX source |
|---|---|---|
| Frost Nova | freeze all enemies 3 s | `pixelfx/fx/ice/*` |
| Ember Burst | ring damage around the cat | `pixelfx/fx/fire/*` |
| Arcane Shield | 2 s invulnerable + reflect | `pixelfx/fx/arcane/*` |
| Chain Lightning | arcs jump between 3 enemies | `pixelfx/fx/lightning/*` |

`pixelfx` is a Node ESM library (244 effects drawn from code). The browser build here has no
bundler, so the current arcs are hand-drawn in `drawPowerFx()`. To use the real library,
either vendor a single effect file and inline it, or add esbuild and import
`pixelfx/fx/<cat>/<name>` — both are viable, the second keeps the gallery browsable.

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
