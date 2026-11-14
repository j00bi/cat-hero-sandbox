# Art pipeline — Cat Hero sprite sheets

How the cat art has been produced so far, so a new sheet can be made the same way
without re-deriving it. Two sources: **AutoSprite** (image→video→pixel sheet) and
**Gemini / Nano Banana** (direct strip generation). Same ingestion either way.

---

## 1. What AutoSprite actually did

Session: `session-12551cbf-bfa1-44f9-851d-f83932b37469`, 13 Nov 2026, free plan,
account Ahmad Husni, **15 credits**.

Steps as performed in the app (`autosprite.io/app`, visual browser, signed in):

1. **Seed image.** Built from an existing walk frame: crop the 96×96 cell from
   `assets/cat-atlas.png`, take its bbox, upscale **8× nearest** → 
   `out/autosprite-seed-cat.png` (768 px). Uploaded as the character reference.
2. **New Character** → name `Cat Hero` → prompt (verbatim):

   > A chunky tuxedo cat. Black coat with a white bib, white muzzle and white paws.
   > Oversized round head, small triangular ears, short legs, thick tail. Side profile
   > facing right, standing on all fours. 16-bit pixel art style, 1 px dark outline,
   > flat colours, no anti-aliasing.

3. **Select Animations** → `Side-scroller` (quadruped, not Isometric) → sheet shown as
   `25 frames · 256px` → `Generate 5` (5 credits).
4. **Preview → Pixel Art switch ON.** Defaults were 64 px / 6 frames; rebuilt to
   **96 px / 8 frames** to match the atlas cell size → `Download Pixel Art`
   (768×96 = 8 cells, 10 fps).
5. Repeat for the run animation → 8 frames at 5 fps.
6. Jump was generated but **not downloadable**: the free plan allows **2 sprite-sheet
   downloads per month**, so the third was refused ("You've used your 2 free downloads
   for this month"). It unlocks at the monthly reset.

Export menu offers `Game-ready 256px · 25 frames`, `Hi-res 512px · 49 frames`,
`Light 128px · 16 frames`, `Custom Size and frames`.

### Why not just re-run it

2 downloads/month, and the app's pipeline is image→**video**→re-timed sheet. It also
re-samples the whole character, so proportions drift from the approved sheet unless
the seed image is exact.

---

## 2. Gemini / Nano Banana equivalent

Generate the strip directly instead of a video frame sequence. The settings to
reproduce are the ones that mattered: **one row, exact frame count, one baseline,
flat colours, 1 px outline, no anti-aliasing, plain chroma background for cutting.**

Rules for every strip prompt:

- one horizontal row, **exactly N frames**, evenly spaced
- **one shared baseline** — paws on the same line in every frame
- **identical scale and proportions** across the row
- flat fills, 1 px dark outline, no gradients, no anti-aliasing, no motion blur,
  no speed lines, no shadow, no text, no numbers, no boxes
- solid magenta `#ff00ff` background, edge to edge — `tools/strip_atlas.py` keys it out
- side profile, facing right, one cat only

Attach the approved tuxedo pose as the reference image and say "same character, same
proportions as the attached reference".

### Walk — 8 frames, 96 px cells

```
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading,
no anti-aliasing, no motion blur, no speed lines, no shadows, no gradients, no text.

Same chunky tuxedo cat as the attached reference: black coat, white bib, white muzzle,
white paw tips, amber eyes, oversized round head, small triangular ears, short legs,
thick tail held up. Side profile, facing right, on all fours.

Exactly 8 frames in one horizontal row, evenly spaced, identical scale, all paws on one
shared baseline, solid magenta #ff00ff background edge to edge, no text, no numbers,
no boxes.

1 front-left paw forward and down, rear-right back and up
2 body at its lowest, both front paws gathered under the chest
3 front-left paw under the body, rear-left lifting
4 body rising, front-right reaching forward
5 front-right forward and down, rear-left back and up
6 body lowest again, both front paws under the chest
7 front-right under the body, rear-right lifting
8 body rising, front-left reaching forward
```

### Run — 8 frames, 96 px cells

Same preamble, then: body pitched forward and lower than the walk, tail streaming
behind, frames 3–4 fully airborne. Pose list: gather · push-off · airborne stretch ·
full extension · descend · contact · gather · push-off.

### Jump — 4 frames

Same preamble, then: legs tucked rising · spread at apex · legs reaching down ·
ready to land. Identical scale in all four.

### Charge / hold — 1 frame

Same preamble. Crouched and coiled, glow gathering under the paws, feet on the
ground, **the cat must be the same height as the walk frames** (this is the pose that
came out 65 px against 74 px the first time and had to be rebuilt).

---

## 3. Ingest a strip

```bash
python3 tools/strip_atlas.py --strip walk=out/gemini/walk-strip.png \
                             --strip run=out/gemini/run-strip.png \
                             --base out/autosprite/base-assets
```

What it does: segments the strip by background-free columns, registers every frame to
one shared baseline, scales each to fit 92×84 inside the 96 px cell, snaps every pixel
to the Apollo palette, appends the row to a clean copy of the atlas, and derives the
grey skin from the black one.

Then:

1. Bump `ART_V` in `game.js` (currently `gemini2`) — browsers cache the atlas by it.
2. Eyeball `out/*/contact.png` or the app itself. Numbers cannot see a swapped tail.
3. Run the suites: `BASE=http://127.0.0.1:8124 node tools/<suite>.mjs` for all 14.

`tools/atlas_patch.py` is the other half: it normalises an existing cell (baseline,
foot, scale) without regenerating art — that is how the charge pose was fixed to
74 px with `foot: 7`.

---

## 4. Hard constraints

| thing | value |
|---|---|
| cell | 96 × 96, transparent |
| foot line | bottom − 8 px (`foot: 7` in the atlas) |
| hitbox | 34 × 42 above the foot line |
| palette | Apollo, tolerance 0 (`spec/character.json`) |
| facing | right |
| atlas sets | `black`, and `grey` derived from it |
| cache bust | `ART_V` in `game.js` |
