# Character redesign — checklist

Status as of 2026-11-10. ✅ done · 🟡 partial · ⬜ not started · ❓ decision needed

---

## 1. Decisions

| | Item | State |
|---|---|---|
| ✅ | Same cat, better acting — no new mechanics, no wall cling | locked |
| ✅ | Tuxedo skin (black + white bib/muzzle/paws) | locked |
| ✅ | Chunky loaf proportions, big head, short legs | locked |
| ✅ | 96 × 96 cells, 87 × 66 footprint, 34 × 42 hitbox, foot line −8 | locked |
| ✅ | Apollo palette, 46 colours, tolerance 0 | locked |
| ✅ | Frame counts 8 / 8 / 4 / 4 / 4 = 28 per variant, 56 total | locked |
| ✅ | Swipe row kept (game combat + boss depend on it) | locked |
| ❓ | **Tail: short bobtail (as generated) or long curved (as specified)?** | decide before grey |
| ❓ | **Eye: amber `#e8c170` (as generated, reads better) or cyan `#73bed3`?** | decide before grey |

## 2. Assets to produce

| | Asset | State |
|---|---|---|
| 🟡 | Tuxedo reference frame | cropped → `spec/ref-tuxedo.png` |
| 🟡 | Tuxedo sheet (first attempt) | exists but 6-frame rows, motion blur, drawn rules, weak swipe |
| ✅ | Tuxedo **walk** — 8 frames, upright | `out/walk-v1-atlas.png` (accepted) |
| ✅ | Tuxedo **run** — 8 frames, fast trot | `out/run-v3-atlas.png` (v3 accepted) |
| ⬜ | Tuxedo **jump** — 4 frames | regenerate (drop the arc line) |
| ⬜ | Tuxedo **swipe** — 4 frames | regenerate (no slash streaks, no tongue) |
| ⬜ | Tuxedo **specials** — 4 frames | regenerate (order: curl, play, stretch, yawn) |
| ⬜ | Grey twin — 28 frames | after tuxedo is approved |
| ⬜ | `cat-atlas.png` + `cat-atlas.json` | export from approved rows |

## 3. Prompts to use

| | Prompt | File |
|---|---|---|
| ✅ | Character reference (step 0) | `spec/prompts.md` |
| ✅ | Walk / run / jump / swipe / specials, one paste each | `spec/row-prompts.md` |
| ✅ | Grey twin (attach approved tuxedo row) | `spec/row-prompts.md` |
| ✅ | v2 corrections: artifact negatives, leg scripts, tail pin | `spec/prompts.md` |

## 4. Tools

| | Tool | State |
|---|---|---|
| ✅ | `tools/auto_cut.py` — chroma key, rule removal, slice, Apollo snap, 87×66 | works on single rows, fragile on full sheets |
| ✅ | `tools/cut_sheet.py` — fixed-grid cutter | fallback |
| ✅ | `tools/prep_sheet.py` — key + downscale + quantise | works |
| 🟡 | `tools/sprite_qc.py` — palette/alpha/geometry gate | **needs update from 36-frame v1 to 56-frame v2** |
| 🟡 | `scenes/SheetPreview.tscn` in sprite-studio | plays rows; screenshot capture broken headless |
| ✅ | `tools/cut_sheet.py` output check at 87×66 | in-game comparison made |

## 5. Verification, per row

| | Check | How |
|---|---|---|
| ⬜ | Frame count exact | `sprite_qc.py` |
| ⬜ | Poses genuinely differ | eyeball the filmstrip, not the sheet |
| ⬜ | Palette = Apollo only | `sprite_qc.py` |
| ⬜ | Binary alpha, no halo | `sprite_qc.py` |
| ⬜ | Feet on the foot line, body ≤ 42 px above it | `sprite_qc.py` |
| ⬜ | Reads at 87 × 66 | in-game size render |
| ⬜ | No artifacts: rules, arcs, blur, streaks, text, props | eyeball |

## 6. Integration

| | Step | State |
|---|---|---|
| ⬜ | Build `cat-atlas.json` with keys `idle/walk/run/jump/bat/rest/sleep` mapped from the new rows | — |
| ⬜ | Replace `assets/cat-atlas.png` + `.json` | — |
| ⬜ | Code changes | **none needed** — frame counts are data-driven |
| ⬜ | Suites: `test`, `platforms`, `mobile`, `boss`, `design`, `palette`, `playthrough` | run after swap |
| ⬜ | Fresh screenshots of all 8 screens | `tools/shots-all.mjs` |
| ⬜ | Rebuild itch zip + publish | `tools/publish.sh` |

## 7. Known risks

- **Full-sheet auto-cutting is unreliable.** Rows aren't evenly spaced; airborne poses sit higher. One row per image is the only stable path.
- **Walk cycles don't animate** in the first sheet — the model redraws one stance. Only the explicit leg script fixes this.
- **Cell size 296 × 354** in the generated sheet is ~3.4× the game sprite, so detail is invented at a scale the player never sees.
- **84,701 colours** in the source → quantisation is doing heavy lifting; expect some detail loss in fur shading.
- **Grey must be derived from the approved tuxedo image**, never generated independently — that's how it became a different cat last time.

## 8. Definition of done

A player cannot tell the character changed engine, only that it looks better:

- 28 frames per variant, both variants side by side in the select screen
- walk and run visibly animate at 11 and 15 fps
- all seven suites green
- itch zip rebuilt, Pages republished
- `CHARACTER.md` updated with the new frame counts
