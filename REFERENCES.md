# World-building sprite galleries — shortlist

For the CAT HERO world (meadow, orchard, ridge, docks, mill, den). Two different jobs:
**browse for reference** vs **download and ship**. Keeping them apart matters — most
"sprite galleries" are fine to look at and illegal to ship.

Current in-game grid: 32 px tiles, cat ≈ 66 px tall, 960×540 logical screen.

---

## 1. Ship-safe, licence verified

| Pack | Grid | Licence | Why it fits |
|---|---|---|---|
| [Kenney — Pixel Platformer](https://kenney.nl/assets/pixel-platformer) | 18×18, 200 files | **CC0** (verified on page) | terrain, backgrounds, props; Kenney also ships [Farm](https://kenney.nl/assets/pixel-platformer-farm-expansion), [Industrial](https://kenney.nl/assets/pixel-platformer-industrial-expansion) and [Food](https://kenney.nl/assets/pixel-platformer-food-expansion) expansions in the same set |
| [Pixel Adventure — Pixel Frog](https://pixelfrog-assets.itch.io/pixel-adventure-1) | 16×16-ish | **CC0** (verified on page) | the closest tonal match to CAT HERO: grass ledges, floating fruit, moving platforms, 20 enemies in the sequel |
| [Kenney — 1-Bit Platformer Pack](https://kenney.nl/assets/1-bit-platformer-pack) | 1-bit | CC0 | only if you ever want a monochrome mode |

> 18×18 and 16×16 both need a 2× upscale to sit on CAT HERO's 32 px grid — that is a
> nearest-neighbour `×2`, not a resample, or the pixels smear.

## 2. Browse / reference only — do not ship

| Source | What it's for |
|---|---|
| [itch.io — free pixel-art tilesets](https://itch.io/game-assets/free/tag-pixel-art/tag-tileset) | 21k+ free assets; filter by **Tileset**, **Backgrounds**, **16x16/32x32** |
| [itch.io — pixel platformer assets](https://itch.io/game-assets/free/genre-platformer/tag-pixel-art) | platformer-specific; Sprout Lands, GandalfHardcore 32×32, ansimuz 16-bit live here |
| [OpenGameArt — platformer tilesets](https://opengameart.org/art-search-advanced?keys=platformer+tileset&field_art_type_tid%5B%5D=9&sort_by=count&sort_order=DESC) | 423 results, licences vary per entry (CC0 / CC-BY / GPL) — check each |
| [Lospec palette list](https://lospec.com/palette-list) | palettes only; the restyle already committed to a sampled meadow palette |
| [The Spriters Resource](https://www.spriters-resource.com/) | **ripped commercial sprites** — reference for shape/animation timing only, never ship |
| [PixelJoint gallery](https://pixeljoint.com/) | craft reference: dithering, outlines, cluster shading |

## 3. Fit notes for this project

- CAT HERO's world is **drawn procedurally in `game.js`** (trees, bushes, signs, castle,
  parallax ridges) and coloured from the sampled `C` palette. A downloaded tileset would
  replace that system, not decorate it — expect a rewrite of `drawSolids`/`drawDecor` plus
  a new level-data format, which the reach BFS and autopilot both depend on.
- Cheapest real improvement: keep the drawn world, and use the galleries for **props and
  background furniture** (signs, fences, pots, clouds) redrawn at 32 px in the existing
  palette. That is additive and testable.
- If you do commit to a pack, commit hard: one pack, one palette, one scale. Mixing a CC0
  pack with the current procedural art is the fastest way to make the game look stitched.

## 4. Licence rules of thumb

- **CC0** — ship it, no attribution, no strings. Kenney and Pixel Adventure are the safe defaults.
- **CC-BY** — ship with credit in the README and in-game credits.
- **CC-BY-SA** — the SA propagates to your art; usually avoid in a game.
- **"Free for commercial use"** on itch — read the actual clause; many forbid resale of the
  assets themselves, which is fine, but some forbid use in games sold on certain stores.
- **Ripped sprite sheets** — copyrighted, reference only.
