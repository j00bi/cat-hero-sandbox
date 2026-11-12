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

## Stage-skip panel

With `?dev=1` a **SANDBOX** panel appears top-right. It is the fastest way to inspect any
stage without playing the previous one — especially on a phone, where the `L` key does not
exist.

| Control | Does |
|---|---|
| `2-1 … 2-5` | Jump straight to that stage (Backyard, The Climb, Dust Bin, The Motor, The Den). The current stage is outlined in gold. |
| `◀ PREV` / `NEXT ▶` | Step one stage at a time. |
| `RESTART` | Reload the current stage with 3 lives, full boss HP, charge reset. |
| `×` | Collapse the panel to a small `DEV` pill; click the pill to bring it back. |
| `` ` `` | Toggle the panel (and the dev text overlay) without touching the mouse. |

The panel is dev-only: on the production URL it is not created and the `DEV` pill stays
hidden. Buttons release keyboard focus after a click, so Space still jumps instead of
re-pressing the last button. Keyboard equivalents live in the overlay: `L` next, `R` restart.

`node tools/sandbox.mjs` covers every jump, next/restart, hide/reopen, the production
hidden state, and tapping the panel on an iPhone viewport.

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
node tools/phase11.mjs     # Shift guard, blur cancel, fizzle
node tools/sandbox.mjs     # stage-skip panel: jump, next, restart, phone, prod hidden
node tools/reach.mjs       # every platform still reachable
node tools/playthrough.mjs # autopilot clears the 2D stages
node tools/ray.mjs         # Dust Bin + Motor first-person rooms
node tools/mobile.mjs      # touch path still works
node tools/boss.mjs        # the Dust King still works
node tools/design.mjs      # HUD stays out of the play band
```

`tools/playthrough.mjs` is the one that catches mechanics that accidentally make a room
unfair — if a dumb bot holding right can't finish, a player will hit the same wall. It
skips the two ray rooms; `tools/ray.mjs` drives those.

## Ray rooms

DUST BIN (`2-3`) and THE MOTOR (`2-4`) are ordinary `LEVELS` entries with `ray: true`.
`game.js` hands them to one `ray.js` instance at load/update/render and on charge release;
hit them with `RAY.debugTeleport(x, y, dx, dy)` from the console.

**Dust Bin** — dark; the light radius grows with charge. Three toys are tucked
around the maze, and the exit door is on the right.

```
########
#S..d..#
#.##.#.#
#..T.#T#
##.#...#
#..d.#.#
#T##...D
########
```

**The Motor** — lit; brush walls open/shut in a 1.2 s / 1.0 s cycle, the core sits
in the middle, exhaust grill on the right.

```
#######
#S.B..#
#.#.#.#
#..M..#
#.#.#.#
#..B.E#
#######
```

| Tile | What it does |
|---|---|
| `#` / `d` | wall / dust pile (0.45 high, blocks sight) |
| `D` | exit door — opens within 1.25 tiles, walk in to clear |
| `B` | brush wall — open 1.2 s, shut 1.0 s, phase-offset per tile |
| `T` | toy — +25 charge |
| `M` | motor core — full charge within 1.7 tiles while facing it → blast → next stage |
| `E` | exhaust grill (solid, glows) |
| `S` | start (faces the longest corridor unless `face` is set) |

Controls: `←`/`→` (or `A`/`D`) turn, `↑`/`W`/`Space`/`Z` walk forward,
`↓`/`S`/`J`/`X` walk back, hold `Shift`/`C` to charge and release to cast.
On touch, JUMP is forward, PAW is back and ⚡ is charge. Charge fills only while
not walking forward/back; moving while charging is slowed to 35%.

The charge layering inside ray rooms mirrors the 2D order: far sparks → paws →
near sparks → arcs, drawn at 320×180 and upscaled 3× with smoothing off.

```bash
node tools/ray.mjs     # needs a server on :8920, or set BASE
```

It checks both room starts, that all art loaded, the dust-bin door clear, a 100 %
charge screenshot, the lit door, the motor core, fps while charging, the motor
blast advancing to the boss, and a held JUMP on an iPhone viewport. Exits 0 only
with no console/page errors.

### Ray art

All of the first-person art is supplied PNG, loaded once by `ray.js` and sampled
per pixel into the 320×180 buffer (so lighting, depth and wall occlusion still apply):

| Asset | Used for |
|---|---|
| `assets/ray/wall-metal.png` | clean metal panels (bin + motor walls) |
| `assets/ray/wall-mold.png` | mouldy wall patches in the bin; also tints dust piles |
| `assets/ray/wall-rust.png` | the motor room's rusted walls |
| `assets/ray/wall-wet.png` | rain-streaked wall patches in the bin |
| `assets/ray/door.png` | the `D` exit door, sliding up as it opens |
| `assets/ray/vent.png` | the `E` exhaust grill |
| `assets/ray/motor.png` | the `M` motor core sprite (magenta keyed out) |
| `assets/paws.png` + `assets/paws.json` | first-person paws, 4 idle + 4 charge frames |

Textures are 128×128 (motor 96×128) — one tile face never needs more at 320 px wide.
Bin walls pick metal/mould/wet per cell from a hash so the maze does not look cloned.
If an image has not loaded yet, the original code-drawn texture/paw is the fallback.
The art is true-colour, deliberately **not** Apollo-quantised; the UI and 2D sprites
keep the Apollo palette. `RAY.assets()` reports `{tex, paws}` readiness for tests.

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

## Charge layers

The charge is drawn in six passes, back to front — the layering is what gives the flat
sprite volume:

| Order | Layer | What |
|---|---|---|
| 1 | ground glow | flattened additive ellipse under the feet |
| 2 | back arcs | bolts behind the hips and tail, partly hidden by the body |
| 3 | back aura | soft radial glow behind the body |
| 4 | charge sheet | pixelfx build frames, behind the cat |
| 5 | orbit sparks (far half) | `sin(angle) < 0`: small, dim blue, no trail |
| 6 | **cat** | the held crouch |
| 7 | orbit sparks (near half) | `sin(angle) > 0`: 2x size, pure white core, one-frame trail |
| 8 | front arcs | bolts radiating from the chest, crossing the body |
| 9 | screen flash | white overlay on release |

Sparks orbit a flattened ellipse: `x = cos(a)*r`, `y = sin(a)*r*tilt`. The sign of
`sin(a)` decides whether a spark draws before or after the sprite — that single switch is
what makes the ring read as circling *around* the cat instead of on top of it.

Escalation is driven by one number, `chargeLevel()`:

| Stage | Charge | Adds |
|---|---|---|
| 1 | 0–40% | one spark, faint ground glow |
| 2 | 40–60% | all five sparks, back aura grows |
| 3 | 60–100% | front arcs, sprite jitter, ground glow peaks |

Release runs `hitstop 0.05s` → `flash` → burst frames. Stage 3 also adds a 2 px shake
rumble (never a fractional zoom — that shimmers on pixel art) and a rim light: the sprite's
own silhouette, tinted cyan and drawn 1 px toward the bolts before the cat, so the body edge
catches the charge without a shader. The sprite also picks up
1 px random jitter that increases with the charge level, so the held pose never looks frozen.

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

- **Charge:** **hold `Shift`** (or `C`) — the cat crouches and the meter fills at 95/s (full in ~1.1 s).
  Releasing early is a fizzle: the meter is kept, with a puff of grey dust. Losing focus cancels the hold.
  Moving or leaving the ground cancels the crouch and keeps whatever charge you banked.
  Stomping an enemy adds **+28** instantly and collecting a fish **+7**, so fighting is the
  fast way to charge and holding still is the slow way.
- **Spend:** **release `Shift`** while the meter is full to cast the selected power. Charge resets.
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
