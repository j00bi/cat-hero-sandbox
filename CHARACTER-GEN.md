# CAT HERO — redesign spec (v2)

**This replaces the 36-frame/wall-cling spec.** That version changed the game; this one does not.
Same cat, same movements, same mechanics — redrawn with denser cycles and a tuxedo skin, in the
labelled movement-sheet format you showed.

Frame grid: `spec/movement-sheet-guide.png`. Machine twin: `spec/character.json`.

---

## What the sheet contains

Two variants, **5 rows each, 28 frames per variant, 56 total**:

| Row | Frames | Replaces | In-game key |
|---|---|---|---|
| WALK | 8 | current 5-frame walk | `walk` |
| RUN | 8 | current 5-frame run | `run` |
| JUMP | 4 | current 3-frame jump | `jump` |
| SWIPE | 4 | current 3-frame `bat` | `bat` |
| SPECIALS | 4 | current `rest` + `sleep` | decorative |

Specials, in order: **curl sleep · idle play · stretch · yawn**.

**Why the swipe row exists.** Your reference sheet has no attack row, but CAT HERO's combat is
paw-swipe + stomp and the Dust King's stun window depends on the player reading that animation.
Drop it and the fight loses its telegraph. If you'd rather the sheet be a pure movement sheet,
say so and I'll cut the row and re-spec the attack as a procedural arc.

**Why the redraw is safe.** Frame counts come from `cat-atlas.json`, and the game cycles
`frames.length`. Going 5 → 8 frames needs **no code change** — only a new atlas.

## Canvas and palette

| | |
|---|---|
| Cell | 96 × 96, transparent |
| Foot line | bottom − 8 px |
| Hitbox | 34 × 42 above the foot line |
| Facing | right |
| Palette | Apollo, **tolerance 0** |
| Tuxedo coat | `#090A14` · `#151D28` · `#202E37` |
| Tuxedo white | `#EBEDE9` · `#C7CFCC` · `#A8B5B2` |
| Grey coat | `#394A50` · `#577277` · `#819796` |
| Eye | `#73BED3` |

## Paste this into Nano Banana — one row at a time

Generate the **tuxedo** first, approve it, then use that image as the reference for the grey.

### Tuxedo — walk (repeat the pattern for run/jump/swipe)

```
Pixel art sprite sheet, 16-bit style, 1 px black outline, flat colours, no gradients,
no anti-aliasing, transparent background.

A chunky tuxedo cat: black coat, white bib, white muzzle and white paws, oversized
round head, small triangular ears, short legs, thick tail, side profile facing right.

One horizontal row of 8 evenly spaced walk-cycle poses, feet on a shared baseline,
identical proportions in every pose: contact front paw, down, passing, up,
contact back paw, down, passing, up.

Flat cream #E7D5B3 background, no text, no labels, no borders, no shadow.
```

Then per row, swap only the pose list:

| Row | Pose list to paste |
|---|---|
| RUN | push-off, airborne, reach, contact, push-off, airborne, reach, contact |
| JUMP | legs tucked rising, spread at apex, legs reaching down, ready to land |
| SWIPE | wind-up paw back, contact paw forward, follow-through, recover |
| SPECIALS | curled sleeping, playful crouch, stretching, yawning |

### Grey variant

```
Same character, same poses and proportions as the attached reference sheet,
but grey fur: #394A50 body, #577277 mid, #819796 highlights, white muzzle and paws.
```

## What to expect, and the post-process

Nano Banana will not honour 96 px cells or a 46-colour lock. It gives you *art to cut*:

```bash
python3 tools/prep_sheet.py out/walk.png --cols 8 --rows 1 --cell 96
python3 tools/sprite_qc.py   out/walk-sheet.png
```

`prep_sheet.py` (next) crops to the grid, nearest-neighbour downscales, and snaps every pixel to
Apollo. `sprite_qc.py` rejects wrong palette, soft alpha, floating feet or an oversized body —
so a drifting generation fails loudly instead of silently landing in the game.

## What this does NOT do

- No wall cling, no double jump, no new ability.
- No physics retune — 272 / −690 / 2200 stay exactly as they are.
- No new rooms, no boss redesign.

That was v1. This is the art redesign you asked for.
