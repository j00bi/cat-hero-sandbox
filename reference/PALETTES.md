# Palettes — Lospec shortlist for CAT HERO

You like **Apollo**. Here it is measured against what the game already draws, plus four
alternatives that do different jobs. Numbers below come from `tools/palette_check.py`'s
sibling analysis: every one of the game's 38 distinct colours mapped to its nearest Apollo
swatch by RGB distance.

## The finding that decides it

```
38 current colours -> nearest Apollo swatch
36 within ΔRGB <= 45      (a re-tone, not a redesign)
 2 outliers:
   #81C784 bright grass highlight -> #819796   (Δ51)
   #FFEB3B electric yellow        -> #e8c170   (Δ71)
```

Apollo is effectively a **superset of the palette the game already uses**, with a warmer gold
in place of the electric yellow. Adopting it changes almost nothing at a glance; it just
gives every material a proper 3-step ramp instead of the ad-hoc shades.

## The shortlist

| Palette | Colours | Author | Vibe | Verdict for CAT HERO |
|---|---|---|---|---|
| **[Apollo](https://lospec.com/palette-list/apollo)** | 46 | AdamCYounis | balanced 16-bit; 11 greens, 11 blues, full warm-brown ramp | **Pick this.** Covers 36/38 current colours; enough ramps for six biomes and a paper UI |
| [Endesga 32](https://lospec.com/palette-list/endesga-32) | 32 | ENDESGA | punchy, saturated, arcade | Good if you want the game to *pop* harder; only 4 greens, so the meadow loses depth |
| [Sweetie 16](https://lospec.com/palette-list/sweetie-16) | 16 | GrafxKid | pastel, cute, soft | Great for a cuter reskin or a title/UI skin; too few colours for six rooms |
| [Journey](https://lospec.com/palette-list/journey) | 64 | PineappleOnPizza | dusk, magenta shadows, cinematic | Not the base palette — but **SUNSET RIDGE** should absolutely be painted in it as a chapter palette |
| Current `C` | 41 | sampled from the game | meadow, cream cards | Keep as the *measured* baseline; Apollo is its disciplined version |

Swatch strips for all five, at equal scale: `reference/palettes.png`.

## Apollo → game roles

Mapping the existing tokens onto Apollo, so `const C` can be rewritten without inventing values:

| Role | Current | Apollo |
|---|---|---|
| sky top / mid / low | `#5BA8E5` `#8CC8F0` `#C6E6FA` | `#4f8fba` `#73bed3` `#a4dddb` |
| far / mid ridge | `#2E5A8A` `#4A7A9E` | `#253a5e` `#3c5e8b` |
| grass dark / base / hi | `#2E7D32` `#4CAF50` `#81C784` | `#25562e` `#468232` `#75a743` |
| dirt dark / base / hi | `#3E2723` `#5D4037` `#795548` | `#341c27` `#4d2b32` `#7a4841` |
| paper / shade / edge | `#F4E7C8` `#E0CFA6` `#B99C6B` | `#e7d5b3` `#d7b594` `#c09473` |
| ink | `#1B1410` | `#090a14` |
| gold / deep | `#F2C14E` `#B9852A` | `#e8c170` `#be772b` |
| red | `#C2452F` | `#a53030` |
| boss greys | `#3A3630` `#5A5348` `#8E8271` | `#394a50` `#577277` `#819796` |
| cat highlight | `#8CD9F2` | `#73bed3` |

The paper/ink ramp gains two extra steps, which is exactly what the cards need for hover and
pressed states.

## What changes if you adopt it

- **Cost:** a re-tone of `C` (one file, ~40 lines) plus re-checking `palette_check.py`
  contrast — the paper/ink pair moves but stays far above 4.5:1.
- **Discipline:** 46 colours is a trap unless you restrict yourself. Use at most two ramps
  per material (light + shadow), or you get the muddy "too many browns" look.
- **Bonus:** Apollo makes the **SUNSET RIDGE** and **THE DEN** rooms cheap to differentiate —
  the palette already carries dusk oranges and a deep teal that the current 41 do not.
- **Caveat:** the extracted cat atlas is not palette-bound; the sprites keep their own colours
  unless you quantise the atlas PNG to Apollo too. That is a one-off PIL job if you want it
  fully consistent.

## Separate: the Kenney style board

`reference/style-board.png` stacks the current meadow frame above Kenney's Pixel Platformer
previews at equal width. What it shows without a word: Kenney's grid is 18×18 and reads
**chunkier and flatter** — fewer shades per material, hard 1-px outlines. CAT HERO is softer
and more shaded. Mixing them would look stitched; the packs are a prop/reference source, not
a drop-in replacement.

> The pack itself cannot be fetched programmatically — `kenney.nl/download-link/...` returns
> `{"error":"forbidden"}` without a session cookie. One click at
> <https://kenney.nl/assets/pixel-platformer> and it lands in `~/Downloads`.
