# Row prompts — one paste per row

Each block is self-contained: character, style, layout, per-frame poses, negatives.
Generate a row, QC it, keep it. Do not regenerate the whole sheet.

Shared by every block:

- **Cream background** `#e7d5b3`, flat, edge to edge, no vignette.
- **Character**: chunky tuxedo cat — black coat `#090a14` / `#151d28` / `#202e37`, white bib,
  muzzle and paws `#ebede9` / `#c7cfcc`, amber eye `#e8c170`, 1 px dark outline, flat fills,
  2-step shading.
- **Negatives**: no motion blur, no speed lines, no ghosting, no trajectory arcs, no impact
  streaks, no shadows, no gradients, no text, no labels, no numbers, no props.

---

## WALK — 8 frames

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no
anti-aliasing, no motion blur, no speed lines, no ghosting, no shadows, no gradients.

A chunky tuxedo cat: black coat, white bib, white muzzle, white paw tips, amber eyes,
oversized round head, small triangular ears, short legs, thick tail held up and slightly
curved. Side profile, facing right. One cat only, identical in every frame.

Exactly 8 frames in one horizontal row, evenly spaced, feet on one shared baseline, cat fills
about 70% of the frame height, cream background #e7d5b3 edge to edge, no text, no numbers,
no boxes.

Each frame must differ clearly from its neighbours:
1 front-left paw forward and down, rear-right paw back and up
2 body at its lowest, both front paws gathered under the chest
3 front-left paw under the body, rear-left lifting off the ground
4 body rising, front-right paw reaching forward
5 front-right paw forward and down, rear-left paw back and up
6 body lowest again, both front paws under the chest
7 front-right paw under the body, rear-right lifting off
8 body rising, front-left paw reaching forward
</prompt>

---

## RUN — 8 frames

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no
anti-aliasing, no motion blur, no speed lines, no ghosting, no shadows, no gradients.

A chunky tuxedo cat: black coat, white bib, white muzzle, white paw tips, amber eyes,
oversized round head, small triangular ears, short legs, thick tail streaming behind. Side
profile, facing right. One cat only, identical in every frame. Body pitched forward, lower
than in the walk.

Exactly 8 frames in one horizontal row, evenly spaced, consistent scale, cream background
#e7d5b3 edge to edge, no text, no numbers, no boxes. Frames 3 and 4 are fully airborne.

Each frame must differ clearly from its neighbours:
1 gather — body compressed, all four paws under the body, tail low
2 push-off — rear legs thrusting back, front legs reaching forward
3 airborne stretch — all four paws off the ground, front legs extended forward, rear legs
  extended back, body at its longest
4 full extension — body horizontal and stretched, fore and hind legs wide apart
5 descend — front paws reaching down for the ground, rear legs still trailing
6 contact — front paws on the ground, rear legs gathering forward
7 gather — rear paws swinging under the hips, front legs pushing back
8 push-off again — rear legs extending, front legs reaching, ready to repeat frame 3
</prompt>

---

## JUMP — 4 frames

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no
anti-aliasing, no motion blur, no speed lines, no arc lines, no ghosting, no shadows.

A chunky tuxedo cat: black coat, white bib, white muzzle, white paw tips, amber eyes,
oversized round head, small triangular ears, short legs, thick tail. Side profile, facing
right. One cat only, identical in every frame, identical scale in all four.

Exactly 4 frames in one horizontal row, evenly spaced, cream background #e7d5b3 edge to edge,
no text, no numbers, no boxes, no trajectory arc, no dotted line.

1 crouch — body low to the ground, legs compressed, tail down, about to spring
2 launch — body angled upward, front legs tucked, rear legs extended down and back, tail
  trailing
3 apex — body horizontal, legs tucked close, tail up, ears back
4 descend — front legs reaching forward and down, rear legs up, tail high for balance
</prompt>

---

## SWIPE — 4 frames

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no
anti-aliasing, no motion blur, no speed lines, no slash marks, no impact streaks, no dust.

A chunky tuxedo cat: black coat, white bib, white muzzle, white paw tips, amber eyes,
oversized round head, small triangular ears, short legs, thick tail. Side profile, facing
right. One cat only, identical in every frame, identical scale.

Exactly 4 frames in one horizontal row, evenly spaced, feet on one shared baseline, cream
background #e7d5b3 edge to edge, no text, no numbers, no boxes. Draw the paw only — no
slash effects, no claws as separate objects.

1 wind-up — front paw pulled back against the chest, shoulder turned, body coiled
2 contact — front paw fully extended forward at chest height, claws out, body leaning in
3 follow-through — paw swept past, body rotated, tail counter-balancing
4 recover — back to a neutral standing stance, paw returning to the ground
</prompt>

---

## SPECIALS — 4 frames

<prompt>
Pixel art sprite sheet, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no
anti-aliasing, no shadows, no gradients.

A chunky tuxedo cat: black coat, white bib, white muzzle, white paw tips, amber eyes,
oversized round head, small triangular ears, short legs, thick tail. Side profile, facing
right. One cat only, identical in every frame, consistent scale.

Exactly 4 frames in one horizontal row, evenly spaced, cream background #e7d5b3 edge to edge,
no text, no numbers, no boxes.

1 curled asleep — tight circle, tail wrapped over the nose, eyes closed
2 playful crouch — front paws down, rear raised, tail flicking, eyes open and bright
3 stretch — front legs extended forward and low, rear up, body long, eyes half closed
4 yawn — sitting upright, mouth wide open, eyes squeezed shut, tail curled at the side
</prompt>

---

## GREY TWIN — attach the approved tuxedo row

<prompt>
Same cat, same poses, same proportions, same spacing and scale as the attached reference row.
Keep the tail raised and slightly curved exactly as in the reference — do not curl it over the
back. Same head width, same ear size, same leg length.

Change only the fur: body #394a50, mid-tone #577277, highlights #819796, keeping the white
muzzle, white bib and white paw tips #ebede9 / #c7cfcc, and the amber eye.

Pixel art, 16-bit style, 1 px dark outline, flat fills, 2-step shading, no anti-aliasing, no
motion blur, no speed lines, no shadows, no gradients, cream background #e7d5b3 edge to edge,
no text, no numbers, no boxes.
</prompt>

---

## QC each row before accepting

```bash
python3 tools/prep_sheet.py out/run.png --cols 8 --rows 1 --cell 96
python3 tools/sprite_qc.py   out/run-sheet.png
```

Reject on: wrong frame count, off-palette pixels, soft/haloed alpha, feet off the baseline,
body taller than 42 px above the foot line.

---

# RUN v2 — the pose list was describing a leap

Two attempts both came back as crouch → leap → land → stand. That is a jump arc, not a run.
The cause is the wording: "gather, push-off, airborne stretch, descend" describes jumping, and
a crouched frame 1 anchors the whole story.

Replace the row with a **fast trot**: body low and pitched forward, all four paws within a few
pixels of the ground, no airborne frame.

<prompt>
Same cat as the attached reference. Pixel art sprite sheet, 16-bit style, 1 px dark outline,
flat fills, 2-step shading, no anti-aliasing, no motion blur, no speed lines, no shadows,
no gradients.

Exactly 8 frames in one horizontal row, evenly spaced. Identical scale and zoom in every
frame — the cat's body length, head size and leg length must not change between poses.
Cream background #e7d5b3 edge to edge. No text, no numbers, no boxes, no ground line.

This is a FAST TROT, not a jump. The spine stays roughly horizontal and low. All four paws
stay within a few pixels of the ground line. No frame is airborne, no frame is a crouched
ball, no frame is standing upright.

1 front-left paw forward and planted, rear-right paw back
2 both front paws gathered under the chest, rear pushing off
3 front-left lifting forward, rear-left extended back
4 front legs crossing under the body, body at its longest
5 front-right paw forward and planted, rear-left paw back
6 both front paws gathered under the chest, rear pushing off
7 front-right lifting forward, rear-right extended back
8 front legs crossing under the body, body at its longest
</prompt>

If a leap is what you actually want, keep it — but that belongs in the 4-frame JUMP row, and
the run should stay a cycle.

---

# WALK — upright, leisurely (differentiates from the run)

The run is a low, level trot. The walk must read as a different gait or the two animations look
identical at 11 vs 15 fps. Ask for upright posture, head high, tail up, short steps.

<prompt>
Same cat as the attached reference. Pixel art sprite sheet, 16-bit style, 1 px dark outline,
flat fills, 2-step shading, no anti-aliasing, no motion blur, no speed lines, no shadows,
no gradients.

Exactly 8 frames in one horizontal row, evenly spaced. Identical scale and zoom in every
frame — body length, head size and leg length must not change between poses.
Cream background #e7d5b3 edge to edge. No text, no numbers, no boxes, no ground line.

This is a relaxed WALK, not a trot and not a jump. The cat is upright, head held high, tail
raised and slightly curved, chest open. Steps are short — a front paw lands roughly under the
chin, not stretched far forward. At least one paw is always planted. Body height stays level;
no bounding, no crouching, no airborne frames.

1 front-left paw forward and planted, rear-right paw lifting
2 both front paws down, body at its lowest
3 rear-left paw swinging forward under the body
4 body at its highest, front-right paw reaching forward
5 front-right paw forward and planted, rear-left paw lifting
6 both front paws down, body at its lowest
7 rear-right paw swinging forward under the body
8 body at its highest, front-left paw reaching forward
</prompt>

## Check on return

- Upright and taller than the run row — if it looks like the run, reject it, that's the whole point
- One paw always on the ground
- Same cat, same tail carriage, same scale across all eight
