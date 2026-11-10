# Prompts — paste into Gemini / Nano Banana

Three blocks. Use **A** for the tuxedo sheet, **B** for the grey twin (attach A's approved
result), **C** when a row drifts and you need to regenerate just that row.

Deliberately absent: coordinates, labels, boxes, captions. Image models cannot render text at
sprite scale — every number in your reference sheet is garbage. Labels are added by our tooling
after cutting.

---

## A — tuxedo movement sheet

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat colour fills, 2-step shading,
no gradients, no anti-aliasing, no blur, no dithering.

CHARACTER: a chunky tuxedo cat. Black coat (#090a14, #151d28, #202e37), white bib, white
muzzle, white paw tips (#ebede9, #c7cfcc). Oversized round head, small triangular ears,
short legs, thick heavy paws, thick tail. Side profile, facing right, all four paws visible.
Determined, slightly grumpy expression. Eye highlight #73bed3.

CONSISTENCY: identical head size, body length, leg length, tail thickness and outline weight
in every single frame. One cat only. No second character. No red toy, no props.

LAYOUT: one sheet, cream background #E7d5b3, five horizontal rows, evenly spaced, aligned to
one shared baseline per row. The cat fills about 70% of its cell height, feet touching the
baseline. No boxes, no borders, no text, no numbers, no coordinates, no captions.

ROW 1 — WALK, 8 poses, evenly spaced: contact front paw · down · passing · up · contact back
paw · down · passing · up.
ROW 2 — RUN, 8 poses: push-off · airborne · reach · contact · push-off · airborne · reach ·
contact. Body pitched forward, two frames fully airborne.
ROW 3 — JUMP, 4 poses: legs tucked rising · spread at apex · legs reaching down · braced to
land.
ROW 4 — SWIPE, 4 poses: wind-up with paw pulled back · contact with paw extended forward ·
follow-through · recover to neutral.
ROW 5 — SPECIALS, 4 poses: curled asleep, tail over nose · playful crouch, front paws down ·
full stretch, front legs forward · big yawn, mouth open, eyes shut.

STYLE LOCK: only the colours listed above. Flat shapes, hard edges, single-pixel outline.
Output a clean sprite sheet, not a poster.
</prompt>

## B — grey twin

Attach the approved tuxedo sheet as the reference. Change only the fur.

<prompt>
Same cat, same poses, same proportions, same row order and spacing as the attached reference
sheet. Redraw it as a grey cat: coat #394a50, #577277, #819796, keeping the white muzzle and
white paw tips (#ebede9, #c7cfcc) and the #73bed3 eye highlight. Identical head size, body
length, leg length and outline weight in every frame. One cat only.

Pixel art, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no gradients, no
anti-aliasing, no dithering. Cream background #E7d5b3. Five rows in the same order: walk 8,
run 8, jump 4, swipe 4, specials 4 (curled sleep, playful crouch, stretch, yawn). No boxes,
no text, no numbers, no props.
</prompt>

## C — single-row fallback

Use when one row drifts in style or proportion. Attach the best frame from the approved sheet.

<prompt>
Same character as the attached reference, identical proportions, outline weight and colours.

Pixel art, 16-bit style, 1 px dark outline, flat fills, no anti-aliasing, cream background
#E7d5b3, side profile facing right, feet on one shared baseline, cat fills about 70% of the
frame height.

One horizontal row of {N} evenly spaced frames: {POSE LIST}.

No boxes, no text, no numbers, no props, no second cat.
</prompt>

| Row | N | Pose list to paste into `{POSE LIST}` |
|---|---|---|
| WALK | 8 | contact front paw, down, passing, up, contact back paw, down, passing, up |
| RUN | 8 | push-off, airborne, reach, contact, push-off, airborne, reach, contact |
| JUMP | 4 | legs tucked rising, spread at apex, legs reaching down, braced to land |
| SWIPE | 4 | wind-up, contact, follow-through, recover |
| SPECIALS | 4 | curled asleep, playful crouch, stretch, yawn |

---

## After generation

```bash
python3 tools/prep_sheet.py out/tuxedo-walk.png --cols 8 --rows 1 --cell 96
python3 tools/sprite_qc.py   out/tuxedo-walk-sheet.png
```

Reject and regenerate anything that fails. A drifting strip that "looks close" is what makes a
sheet unusable later.
