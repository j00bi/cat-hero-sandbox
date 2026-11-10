# CAT HERO — generation spec

For producing a **new sprite sheet** from an image model, and for the code that has to accept it.
Machine-readable twin: `spec/character.json`. Frame grid: `spec/pose-guide.png`.

The character is the **same cat** — same identity, same world, same warm Apollo palette. What
changes is acting, proportions and one new ability.

---

## 1. The character in one paragraph

A chunky black house cat with an oversized head, short legs and heavy paws. Not cute-chibi,
not realistic — the proportions of a cat that eats well and fights a vacuum cleaner. The
silhouette must read at 66 px tall: big round head, small triangular ears, thick tail, no props,
no clothing. Expression carries the character: determined, annoyed, sleepy, triumphant.

Grey variant is the same drawing with a grey fur ramp — identical poses, identical timing.

## 2. Canvas and grid

| Property | Value |
|---|---|
| Cell | **96 × 96**, transparent |
| Foot line | cell bottom − 8 px |
| In-game hitbox | **34 × 42** above the foot line |
| Sprite footprint ceiling | 87 × 66 today — do not grow past it |
| Facing | **right**, always |
| Frames | **36**, laid out per `spec/pose-guide.png` |

Overflow rules: tail, ears, whiskers and the swipe arc may leave the hitbox. The **body** may not.

## 3. Palette lock — Apollo (46 colours)

Fur uses a 3-step ramp, everything else 2 steps:

| Role | Apollo |
|---|---|
| Black fur | `#090A14` → `#151D28` → `#202E37` |
| Grey fur | `#394A50` → `#577277` → `#819796` |
| Eye | `#73BED3` |
| Highlight / whisker | `#EBEDE9` |
| Accent (collar-less, use for eye glint / spark) | `#DE9E41` |
| Contact shadow | none in the sprite — the game draws its own |

No colour outside the 46. The QC script enforces tolerance 0.

## 4. Animation set — 36 frames

| Anim | Frames | FPS | New? | What it must sell |
|---|---|---|---|---|
| `idle` | 4 | 6 | | breathing, tail tip flick, weight on both front paws |
| `walk` | 6 | 11 | | proper contact / passing / lift, shoulders roll |
| `run` | 6 | 15 | | body pitched forward, two frames fully airborne |
| `jump` | 3 | — | | rise (legs tucked), apex (spread), fall (legs reaching) |
| **`cling`** | 2 | 8 | **new** | claws dug in, body vertical against the wall, ears flat, tail hanging |
| **`walljump`** | 2 | — | **new** | push-off frame, then a small tuck/flip |
| `swipe` | 3 | 16 | | wind-up, contact, follow-through |
| **`hurt`** | 1 | — | **new** | eyes shut, ears flat, limbs splayed |
| **`land`** | 2 | — | **new** | squash on impact, recover |
| **`skid`** | 2 | — | **new** | paws braced, tail counterweight |
| `sleep` | 2 | 6 | | curled, tail over nose |
| **`victory`** | 3 | 8 | **new** | sit, stretch, tail up |

## 5. The new ability, and what it costs

**Wall cling + wall jump.** The cat presses into a wall mid-air, slows to 120 px/s, and can kick
off it.

```js
WALL_SLIDE    = 120     // px/s while clinging
WALL_JUMP_VY  = -620
WALL_JUMP_VX  = 300
WALL_COOLDOWN = 0.12
```

Why this is the right ability for this body plan: it gives verticality without touching the
jump envelope every room was designed around. Nothing becomes shorter or floatier.

What it forces elsewhere:

1. **Level design** — the current rooms have almost no tall vertical walls except the boss
   arena's edges. Wall cling will be a party trick in six of seven rooms until walls are added.
   Either accept that v1, or add two wall shafts in 1-5/1-6.
2. **Reachability BFS** — `tools/reach.mjs` models a 190 × 112 jump. Cling adds upward traversal
   it cannot see. Conservative, so it won't false-pass, but it also won't verify the new routes.
3. **Boss fight** — the arena walls are the bait mechanic's trigger. Wall-jumping off them must
   not let the player skip the charge-and-stun loop; add a check that clinging does not put the
   player out of the boss's reach.
4. **Tests** — a new `tools/wall.mjs` should assert: cling engages, slide speed is clamped,
   wall jump applies (−620, 300), cooldown holds, and that all five existing suites still pass.

## 6. Generation workflow

One pass will not produce 36 consistent frames. Three passes do:

**Pass 1 — turnaround (approval gate).** One image: front, side, three-quarter, back, plus a
face-expression row (neutral, determined, annoyed, sleepy). Approve the design here; everything
after is animation.

**Pass 2 — row strips.** One image per animation, N poses laid left-to-right on a flat
`#E7D5B3` background, same character sheet language. Six strips cover the 36 frames. Reject a
strip if the character's proportions drift; do not "fix it later".

**Pass 3 — cut and quantise.** Split on the 96 grid, quantise to Apollo, place on the foot line,
export `cat-atlas.png` + `cat-atlas.json` in the existing format.

## 7. Prompt — paste this

```
CHARACTER: chunky black house cat, oversized round head, short legs, thick tail,
small triangular ears, heavy paws, determined expression, 16-bit pixel art,
1 px ink outline, flat fills, 2-step shading, no anti-aliasing.

VIEW: strict side profile facing right, full body, all four paws visible.

SHEET: {N} frames in one horizontal row, evenly spaced, identical character and
proportions in every frame, feet on a shared baseline, flat cream background
#E7D5B3, no labels, no text, no borders, no shadows.

ANIMATION: {POSE LIST — see table below}

PALETTE: strictly these colours only — #090A14 #151D28 #202E37 #73BED3 #EBEDE9
#DE9E41 #a53030
```

Pose lists per strip:

| Strip | Poses to ask for |
|---|---|
| idle | stand neutral · breathe in · tail flick · blink |
| walk | contact front · passing · lift · contact back · passing · lift |
| run | push · airborne · reach · contact · push · airborne |
| jump | legs tucked rising · spread at apex · legs reaching down |
| cling | claws in, body against wall · grip shift, tail sway |
| walljump | push-off, legs extended · tuck, spinning away |
| swipe | wind-up, paw back · contact, paw forward · follow-through |
| hurt + land | eyes shut, limbs splayed · squash landing · recover |
| skid + sleep | braced skid · skid recover · curled sleeping · tail over nose |
| victory | sit · stretch up · tail high |

**Negative prompt:**
```
photorealistic, 3d render, blurry, anti-aliased edges, gradient shading,
drop shadow, background scenery, multiple characters, text, watermark,
front view, three-quarter view, extra limbs, missing tail, human hands,
clothing, accessories, neon colors, dithering
```

## 8. Acceptance — machine-checkable

`tools/sprite_qc.py` validates a candidate sheet:

- 36 occupied cells in the documented order, none empty
- every opaque pixel ∈ Apollo (tolerance 0)
- each cell's body bbox sits above the foot line and inside 34 × 42 (tail/ears exempt)
- alpha is binary — no semi-transparent halo pixels
- both skins produce identical pose counts

Anything that fails goes back to Pass 2, not into the game.
