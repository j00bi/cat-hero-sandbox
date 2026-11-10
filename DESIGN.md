# CAT HERO — restyle spec

Derived by sampling the running game (PIL, canvas origin 160,130 in a 1280×800 capture),
following the `sprite-sheet-games` restyle protocol: literal palette → layer order →
one draw function at a time → tests as the regression gate.

Fork of `../cat-hero` at `58df729`. The original stays untouched.

---

## What the samples say

| Band (canvas y) | Dominant colours | Verdict |
|---|---|---|
| sky 0–470 | `#5ba8e5` → `#9cd0f3` gradient | fine, keep |
| far ridge | `#2e5a8a`, `#4a7a9e`, `#7fa8c8` | fine, keep |
| ground body | `#5d4037`, `#3e2723`, `#795548` | fine, keep |
| grass cap | `#2e7d32`, `#4caf50`, `#81c784` | fine, keep |
| HUD panels | `#223943`, `#243a43` (green-black glass over blue sky) | muddies against sky — warm it |
| page surround | `#141009` | fine, but cold next to the meadow |

Measured contrast (text vs its own panel background):

```
HUD status panel   12.1:1   pass
world plate        12.1:1   pass
control legend     16.2:1   pass
tutorial box       11.8:1   pass
```

Contrast is **not** the problem. The problems are compositional:

1. **The control legend sits in the play band.** Panel rect is `y 464–506`; the hero stands
   with feet at `y 470` and head at `y ~428`. The legend covers the exact strip where the cat
   runs and lands. Protocol rule: *keep HUD/banner panels out of the play band.*
2. **One panel style for everything.** `panel()` draws the same translucent glass for the HUD,
   the tutorial, the select cards and the pause card — no hierarchy, so nothing reads as
   more important than anything else.
3. **Screens have no typography.** Title/select/clear/game-over/win all place raw text on
   either a busy sky or a flat scrim. No card, no stat line, no alignment grid.
4. **Colour literals leak.** `"#FFF8D6"`, `"rgba(255,255,255,0.65)"`, `"rgba(20,16,13,0.72)"`,
   `"#e8dcc0"`, `"#f2c14e"` and the boss greys are hard-coded in draw functions instead of
   coming from `C`.

---

## Palette tokens (single source of truth)

Every draw call reads from `C`. No literals in draw functions.

| Token | Value | Role |
|---|---|---|
| `skyTop` | `#5BA8E5` | sky gradient start |
| `skyMid` | `#8CC8F0` | sky gradient mid |
| `skyLow` | `#C6E6FA` | sky gradient end |
| `mountFar` / `mountMid` / `mountHi` | `#2E5A8A` / `#4A7A9E` / `#7FA8C8` | parallax ridges |
| `grass` / `grassDark` / `grassHi` | `#4CAF50` / `#2E7D32` / `#81C784` | ground cap |
| `dirt` / `dirtDark` / `dirtHi` | `#5D4037` / `#3E2723` / `#795548` | ground body |
| `water` / `waterDeep` / `waterHi` | `#3B7EC4` / `#2A5E96` / `#8CC8F0` | pits |
| **`ink`** | `#1B1410` | page surround, card borders |
| **`paper`** | `#F4E7C8` | card fill |
| **`paperShade`** | `#E0CFA6` | card inner shade, dividers |
| **`paperEdge`** | `#B99C6B` | card outer edge |
| **`gold`** | `#F2C14E` | selection, score, focus |
| **`goldDeep`** | `#B9852A` | gold shadow |
| `red` | `#C2452F` | damage, danger |
| **`panel`** | `rgba(26,20,14,0.82)` | in-world glass (HUD only) |
| **`scrim`** | `rgba(16,13,10,0.78)` | full-screen dim behind cards |

Warm, not green: the old glass was `rgba(16,24,20,.78)`, which sampled as `#223943` and read
as murky teal against the sky.

---

## Composition rules

1. **The play band is sacred.** Canvas `y 400–506` across the full width belongs to gameplay.
   Nothing persistent is drawn there. Transient effects (damage flash, particles) may cross it.
2. **The legend is not HUD.** Controls appear on the title card and in the pause card, plus a
   first-room hint for 8 s in the top-centre slot (over sky, above the play band).
3. **Two panel kinds.** In-world glass (`panel()`, warm, translucent) for HUD plates only;
   paper cards (`card()`, opaque cream, ink edge, gold tab) for every menu and overlay.
4. **Cards sit on a scrim**, never directly on the sky.
5. **Text on paper is ink, not white.** White on `paper` fails; ink on `paper` is ~13:1.

---

## Screen specs

| Screen | Layout |
|---|---|
| **Title** | sky + ground + trees (unchanged backdrop); paper card 560×300 centred at y 120; wordmark 6×, subtitle gold 2×; cat sprite standing on the card's lower edge; `PRESS ENTER OR TAP` blinking ink; controls line in small caps at the card foot |
| **Select** | two paper cards 260×300 side by side, y 130; selected card lifts 6 px and gains a gold edge + gold tab; cat sprites at 2×; name ink 2×, trait ink-dim 1×; footer hint on the scrim |
| **Clear** | paper card 420×180 centred; `ROOM CLEAR` 4× ink; fish line with gold count; `ENTER FOR NEXT` 1×; card slides in 12 px |
| **Game over** | paper card 420×190; `GAME OVER` 4× red; best fish; `ENTER TO TRY AGAIN` |
| **Win** | paper card 560×340; `HOME AT LAST` 4×; both cats 1.6×; total fish gold 3×; `ENTER TO PLAY AGAIN` |
| **Pause** | glass panel 360×200 with the control legend (moved here from the play band) |

All cards: `card()` = paper fill, 2 px ink border, 4 px `paperEdge` inner line, 10 px radius,
drop shadow offset `(6,8)` in `rgba(0,0,0,0.25)`.

---

## Stages

| # | Change | Gate |
|---|---|---|
| A | spec + token extraction, values unchanged | pixel-identical to `shots/restyle/baseline/` |
| B | HUD: legend out of the play band, panels warms, pause card | `design.mjs`: no panel in y 400–506; contrast ≥ 4.5 |
| C | screens rebuilt on `card()` | all five suites + new screenshots |
| D | verify, publish to the restyle Pages URL | public URL boots clean |

## Verification

- `tools/design.mjs` — asserts the play band is clear and samples contrast from a real frame.
- `tools/palette.py` — asserts no draw-call colour outside the token set in HUD/card regions.
- Existing suites: `test`, `platforms`, `mobile`, `boss`, `playthrough` — unchanged, must pass.
