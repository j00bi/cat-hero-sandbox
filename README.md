# CAT HERO

A small pixel platformer built around the **CAT HERO** sprite sheet. Three rooms, one cat,
one cushion to get home to. No dependencies, no build step — plain Canvas 2D.

![gameplay](shots/hero.png)

## Play

```bash
cd ~/projects/cat-hero
python3 -m http.server 8123
# open http://localhost:8123
```

`file://` will not work — the game fetches `assets/cat-atlas.json`.

## Controls

| Action | Keys |
|---|---|
| Move | `←` `→` (or `A` `D`) |
| Jump | `Space` / `Z` / `↑` / `W` — hold for height |
| Paw swipe | `X` / `J` |
| Pause | `P` / `Esc` |
| Mute | `M` |

On a phone: **tap the screen to start**, then use the on-screen pad.

Touch controls appear automatically on phones and tablets.

## Rules

- 3 lives. Falling into a gap costs one and respawns you at the room entrance.
- Robot vacuums patrol every room. **Stomp** them from above, or **swipe** them with the paw.
- Fish coins are score. The cushion at the end of each room is the exit.
- Three rooms: **The Living Room**, **The Shelf**, **The Garden**.

## How the art got here

The source is a JPEG sprite sheet with a flat beige background, black outlines and
two cats. `tools/extract_atlas.py` turns it into a usable atlas:

1. Estimate the background from the border ring, build an ink mask by colour distance.
2. Label connected components, then group them into rows by vertical centre.
3. Rebuild each frame from the **body blob plus any nearby blob** — thin tails and
   detached paws survive JPEG as separate components and would otherwise be cut off.
4. Bottom-centre each frame in a per-row cell, with a soft alpha key so no beige halo remains.
5. Measure a **foot line** per frame (lowest row with a paw-sized run of ink) so a hanging
   tail never becomes the ground contact point.

Output: `assets/cat-atlas.png` + `assets/cat-atlas.json`
(`{variant: {animation: [{x,y,w,h,foot}]}}`), plus `assets/contact.png` for eyeballing.

## Verification

Not eyeballed — measured. All three scripts run against a live Chromium.

```bash
node tools/test.mjs        # 14 gameplay assertions
node tools/reach.mjs       # every platform reachable from spawn
node tools/playthrough.mjs # autopilot finishes all 3 rooms
node tools/mobile.mjs      # iPhone: tap-to-start, touch pad, hero switch
```

- `test.mjs` — boots the game, plays it with real key events: menu → hero select → room,
  walks, jumps (measures a 105 px apex), swipes, stomps a robot, collects fish, clears the
  room, loads room 2, falls in a pit and confirms the life loss. Fails on any console error.
- `reach.mjs` — BFS over standable surfaces using the jump envelope (190 px across,
  112 px up). Catches decorative platforms that can never be reached.
- `playthrough.mjs` — an in-page autopilot holds right, jumps at gaps and walls, swipes at
  robots, and must reach the cushion in every room. Currently clears all three without
  losing a life.

Playwright is loaded from the Hermes node tree:

```js
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
```

## Layout

```
index.html          canvas + touch buttons
style.css           page chrome
game.js             everything else (~900 lines, no deps)
assets/             extracted atlas, JSON, contact sheet
tools/extract_atlas.py  sprite sheet -> atlas
tools/*.mjs         tests (need a running server on :8123)
shots/              screenshots produced by the tests
```

## Tuning

Physics lives at the top of `game.js`: `GRAV 2200`, `JUMP_V -690` (≈105 px apex),
`MOVE 272`, plus coyote time and a jump buffer. Rooms are plain data — `rect()`, `arc()`
and `line()` helpers build `solids`, `coins` and `enemies`; add a room to `LEVELS` and it
is playable immediately.
