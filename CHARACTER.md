# CAT HERO — character specification

One playable character, two skins. Everything below is measured from `game.js` and
`assets/cat-atlas.json`, not invented — if the sprite and this document disagree, the code wins
and this document is the bug.

Visual reference: `reference/character-sheet.png` (both variants, every animation frame at 2×).

---

## 1. Identity

| Field | Value |
|---|---|
| Name | **Cat Hero** (no proper name — the player names it by choosing a skin) |
| Role | Player character, sole protagonist |
| Fantasy | A house cat crossing six rooms of its own territory to reach its cushion |
| Skins | **Black Cat** — "nimble" · **Grey Cat** — "steady" (identical stats; the labels are flavour) |
| Antagonist relation | The Dust King swallowed the cushion; the cat wants it back, not revenge |

The two skins are mechanically identical on purpose. Differentiation is cosmetic only, and
`state.setIndex` selects the atlas group — there is no stat block to keep in sync.

## 2. Physical spec

| Property | Value | Source |
|---|---|---|
| Sprite frame | 87 × 66 px (black), 76 × 63 px (grey) | `cat-atlas.json` |
| Collision box | **34 × 42 px**, feet-anchored | `player.w/h` |
| Native tile | 32 px | `TILE` |
| Screen | 960 × 540 logical, integer-scaled | `W`, `H` |
| Draw anchor | bottom-centre via per-frame `foot` value | `drawPlayer` |

**Why the box is narrow.** The sprite is 2.5× wider than the hitbox. Whiskers, tail and the
swipe arc are all outside it, so the cat never snags on a wall it visually clears. Any new
frame must keep the *body* inside 34 × 42; overflow is only allowed for tail, ears and effects.

## 3. Movement

| Constant | Value | Feel |
|---|---|---|
| `MOVE` | 272 px/s | top speed; reaches it in ~0.10 s |
| `ACCEL` | 2600 px/s² | snappy start, no skating |
| `FRIC` | 2400 px/s² | stops almost immediately |
| `GRAV` | 2200 px/s² | heavy, arcade-falling |
| `JUMP_V` | −690 px/s | **≈108 px apex** (3.4 tiles, clears a 100 px wall) |
| `MAXFALL` | 980 px/s | terminal velocity |
| `COYOTE` | 0.09 s | jump still fires just after leaving a ledge |
| `JUMP_BUF` | 0.12 s | press just before landing and it lands on the jump |
| Jump cut | `vy` clamped to −400 when the key is released | tap = short hop, hold = full arc |

**Jump envelope** — the number level design depends on: **~190 px across, 112 px up**, at full
speed from a level surface. The reachability test (`tools/reach.mjs`) enforces it; a ledge
higher than 112 px is unreachable and the level is still "playable" because the ground route
works — that is how uncollectable coins ship.

## 4. Actions

| Action | Input | Timing | Notes |
|---|---|---|---|
| Move | `←` `→` / `A` `D` | continuous | no air control penalty; full control mid-air |
| Jump | `Space` / `Z` / `↑` / `W` | variable height | coyote + buffer |
| Paw swipe | `X` / `J` | active 0.26 s, cooldown 0.36 s | hitbox **46 × 32** in front, live between 0.06 s and 0.20 s of the swing; small forward nudge when grounded |
| Stomp | fall onto an enemy | `vy > 120` and feet within 12 px of the enemy top | kills, bounces `vy = −520` |

The swipe is a *safe* option; the stomp is the *risky* one. Enemy contact from the side costs a
life. This is the whole combat vocabulary — no second attack, no dash, no block.

## 5. Animation inventory

| Anim | Black | Grey | FPS | Trigger |
|---|---|---|---|---|
| `idle` | 4 | 4 | 6 | standing, speed ≤ 20 |
| `walk` | 5 | 5 | 11 | 20 < speed ≤ 200 |
| `run` | 5 | 4 | 15 | speed > 200 |
| `jump` | 3 | 3 | — | airborne; **frame picked by vy**, not time: rising `vy < −120` → 0, apex → 1, falling `vy > 200` → 2 |
| `bat` | 3 | 3 | 16 | swipe active |
| `rest` | 3 | 2 | 6 | idle on the title / win screens |
| `sleep` | 2 | — | 6 | decorative sleeping cat; **black only**, falls back to `rest` |

`jump` is the one non-cycled animation: three poses selected by vertical velocity. Adding a
fourth pose means editing `p.frame` selection in `update()`, not just the atlas.

## 6. Damage & states

| Event | Effect |
|---|---|
| Side contact / falling in a pit | −1 life, **1.4 s invulnerability**, knockback `±240 x, −320 y` (pit = respawn at room entry, no knockback) |
| Zero lives | `mode = "gameover"`, best score recorded |
| Boss room hit | respawn at the door **and** the Dust King resets to full health |
| Stomp successful | `0.4 s` grace so the bounce-out doesn't re-trigger contact damage |

Three lives, no health bar. Invulnerability is a blink, not a colour flash.

## 7. Palette (Apollo)

The character keeps its **original atlas colours** — the restyle palette applies to the world
and UI, not to the extracted sprite. If you want the cat quantised to Apollo too, that is a
one-off PIL pass over `cat-atlas.png`; it will change the fur ramp and the eye highlight.

Roles the character already uses consistently:

| Use | Colour |
|---|---|
| Fur base | atlas, near-black `#1F1B1B` / grey `#8A8A8A` |
| Eye / accent | `#73BED3` (Apollo sky mid) |
| Swipe arc | `#EBEDE9` (Apollo white) |
| Damage burst | `#A53030` (Apollo red) |

## 8. Art rules for new frames

1. **Silhouette first.** At 1× (66 px tall) the cat must read as a cat in one colour. If a new
   pose only reads when shaded, the pose is wrong.
2. **Two shades + one highlight per material.** Apollo has 46 colours; using more than three on
   fur makes it muddy.
3. **1 px ink outline**, no interior anti-aliasing. The atlas is JPEG-extracted — clean up edge
   halos before committing.
4. **Feet on the `foot` line.** The exporter writes a per-frame foot offset; a hanging tail must
   never become the contact point or the cat floats.
5. **Keep the tail out of the hitbox.** Tail overlap is fine visually, but it must not extend the
   body inside 34 × 42 or the cat starts catching on geometry.
6. **Animate on 2s and 3s, not 1s.** 11–15 fps reads as a small, heavy animal; 24 fps reads as
   a human in a cat suit.

## 9. Adding an animation

1. Add the row to the sprite sheet, run `tools/extract_atlas.py`, keep the same row order.
2. Confirm the new key exists in `cat-atlas.json` for **both** variants, or add a fallback —
   `sleep` exists only on black and `drawSleepingCat` guards with `ATLAS.black.sleep?.length`.
3. Wire the trigger in `update()`'s animation block (speed thresholds or state).
4. If the anim is velocity-driven like `jump`, select frames explicitly; otherwise the
   `Math.floor(animT * fps) % frames.length` cycle handles it.
5. Re-run `tools/test.mjs` — it asserts `anim` values during walk, jump and attack.

## 10. Open questions

- Should the two skins differ **at all**? Currently a flavour choice; a 5 % speed or jump delta
  would make the select screen meaningful.
- The cat has no voice/audio cue. One 200 ms meow on damage would carry more character than any
  new sprite frame.
- `sleep` exists on one variant only — either give grey a sleep cycle or drop the asymmetry.
