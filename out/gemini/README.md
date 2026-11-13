# Gemini pass — Cat Hero

Built from the supplied character reference and walk/run strips.

## Sources

| File | Used for |
|---|---|
| `character-reference.jpg` | side view → `idle`; loaf → `rest` / `sleep` |
| `walk-strip.jpg` | 8-frame `walk` |
| `run-strip.jpg` | 6-frame `run` |

All three have a flat magenta background; the cutter keys it out by hue (including
the soft shadow), segments the strip by empty columns, registers every frame to a
shared baseline, scales the cat to fit 92×84 inside a 96 px cell, and snaps opaque
pixels to Apollo.

## Build

```bash
python3 tools/gemini_atlas.py
cp out/gemini/cat-atlas.png assets/cat-atlas.png
cp out/gemini/cat-atlas.json assets/cat-atlas.json
```

`tools/strip_atlas.py` is the generic cutter (use it for future strips):

```bash
python3 tools/strip_atlas.py --strip "walk=out/gemini/walk-strip.jpg" --strip "run=out/gemini/run-strip.jpg"
```

The atlas is rebuilt on `out/autosprite/base-assets` so repeated runs do not stack
rows. `idle` is the side view plus a 1 px breathing bob; `rest` is the loaf and
`sleep` is the loaf with the same bob.

## What is new

- `walk` (8 frames), `run` (6), `idle` (2), `rest` (1), `sleep` (2), `jump` (4), both skins.
- Grey skin is derived from the tuxedo frames: black coat → grey ramp, white body
  and amber eyes kept.
- HUD / title / select / win screens all read from that new `idle`, so the whole
  non-airborne game is on the new design.

## Still old

`bat` (paw swipe), `charge`, `stretch` and `play` still use the original atlas.
`bat` is the visible one now: the cat briefly turns back into the mostly-black
tuxedo when you swipe. An attack strip would finish the pass.

`jump` is currently a stopgap: four existing run poses are mapped into the four
`vy` slots (push-off, extended, tucked, land). Same character, but it reads as a
leaping trot rather than a dedicated jump. A real 4-frame jump strip can drop
straight into `clips["jump"]` in `tools/gemini_atlas.py`.

## Verify

```bash
BASE=http://127.0.0.1:8920 node tools/playthrough.mjs   # all 2D levels clear
BASE=http://127.0.0.1:8920 node tools/design.mjs        # HUD layout unchanged
```

Use **port 8920** — 8123 serves a different copy of the game from this workspace.
