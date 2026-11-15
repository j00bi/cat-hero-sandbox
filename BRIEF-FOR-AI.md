# CAT HERO — development brief (for idea generation)

Hand this to an assistant cold. Everything below is already true and built; the last
section says exactly where we want ideas.

## The game in one line

A house cat on the night shift **shifts its body** — half to crawl the ducts, double to
break dust walls — to reach the robot vacuum that swallowed its cushion.

- **Title:** CAT HERO
- **Jam:** GitHub Game Off 2026, theme **SHIFT**. Submissions close **1 December 2026**.
- **Platform:** browser, runs from a static folder, no build step, no dependencies.
- **Playable now:** https://j00bi.github.io/cat-hero-sandbox/

## Why it exists (the interpretation we chose)

"Shift" is read as **shift your body**. Not a camera trick, not a tone shift: the cat
changes size, and the level geometry only opens for one of those bodies. First-person
duct sections exist too, but they are texture, not the thesis.

## Core loop

Enter a room → read which obstacle is in the way → spend charge to shift into the body
that clears it → act (jump, paw, pounce) → reach the goal carrying as many fish/coins.

Everything runs on one resource: **the charge meter** (0–100, refills ~95/s while standing
still and holding SHIFT). It pays for *both* the body shift and the attack, so every use
is a trade.

## Mechanics, with real numbers

**Movement** — run 272 px/s, jump −690, gravity 2200, coyote time 0.09 s, jump buffer
0.12 s, variable jump height. Paw swipe has a 0.36 s cooldown.

**THUNDER POUNCE** — hold SHIFT to charge, release at 100 for a 0.42 s dash at 760 px/s
that kills anything it passes through. Releasing early fizzles and keeps the banked meter.

**The body ladder** — tap SHIFT (a flick under 0.18 s) cycles the body. A full meter
always casts instead, never shifts.

| body | hitbox | speed | jump | cost |
|---|---|---|---|---|
| half | 17×21 | 1.10× | −640 | 25 charge |
| normal | 34×42 | 1.00× | −690 | — |
| double | 68×84 | 0.75× | −600 | 25 charge |

- Shifting takes 0.25 s of committed animation and you are vulnerable.
- **Growing needs 2×2 clearance**; without it, it fizzles (dust puff, low thud) and you
  stay as you are. Shrinking is always legal, so no body can trap the player.
- Death resets you to normal, because a double body carried through a respawn could
  spawn inside geometry it no longer fits in.

**Obstacle vocabulary (the levels are built from these)**

- **Crawl** — 40 px of headroom. Only half fits.
- **Dust barrier** — 170 px of packed dust, taller than any jump. Only a double-size
  pounce breaks it.
- **Drain** (planned) — half falls in, normal and double walk over.
- **Counter** (planned) — a ledge only the normal body reaches.

**SENSOR** — hold TAB for a schematic of the room: walls, every enemy's patrol span, the
vacuum's cone, coins and exit. The cat cannot move while it is up, and it drains 16
charge per second. Deliberately an assist, never mentioned on the title screen.

**First-person duct rooms** — a raycaster (320×180, upscaled) with its own charge meter
and a motor core you overload at full charge. Two rooms use it. It exists to make the
house feel bigger and to hide things the side view cannot show.

## Structure and content

Five stages plus a sandbox:

1. **2-1 BACKYARD** — tutorial: gaps, a robot, the vacuum appears in the background.
2. **2-2 THE CLIMB** — *the first ladder room*: crawl at x=1000, dust wall at x=3180
   sitting directly in front of the goal.
3. **2-3 DUST BIN** — first person, dark, collect toys to charge.
4. **2-4 THE MOTOR** — first person, overload the core.
5. **2-5 THE DEN** — the Dust King: a roomba wearing a crown, with a fuzzy dust ball
   riding on it. 3 HP, opens a stun window after a charge into a wall, stomp it three
   times.

Told through typewriter story cards: the owner leaves for the night shift, the vacuum
wakes up, the cushion is swallowed. Two selectable skins (black / grey tuxedo).

The vacuum itself has a scripted beat: it drives in, brakes over the cushion, drags it in
with suction streaks, gulps, and the cat startles. The motor-core blast hands off to the
boss room with a white hold and fade.

## Tech constraints (these are fixed)

- Vanilla JS + canvas 2D, 960×540 logical, integer-scaled. No libraries, no bundler.
- Sprite atlas: 96×96 cells, feet on a fixed baseline (`foot: 7`), **46-colour Apollo
  palette, tolerance 0**, side profile facing right. Grey skin derived from black.
- `game.js` ≈ 3,000 lines, `ray.js` ≈ 500.
- 16 Playwright suites gate every change (movement, rooms, boss, first person, ladder,
  sensor, mobile, story, transitions). The build deploys by pushing a gh-pages bundle.

## What is built vs missing

**Built:** all five stages, the boss fight, both duct rooms, the story cards, the body
ladder with cost and headroom rules, dust barriers, the sensor, the vacuum beat, the
blast handoff, a dev panel, live deploy.

**Missing or thin:**
- **Audio is placeholder beeps.** No music, no ambience. (Audio is a scored category.)
- The **Dust King has no sprite** — it is drawn procedurally.
- The **story cards have no image** — they fall back to a drawn room.
- **No dedicated jump animation** (four run poses are mapped to velocity).
- Only **one of five rooms** is built around the body ladder. Four more are planned:
  drain, counter, a mixed room, and the boss approach.
- The jam build still shows the dev panel.

## What we want from you

We are not short of features; we are short of **good room ideas and one memorable
moment**. Ideas must fit the existing rules — no new cameras, no new powers, no new
resource systems.

Please produce:

1. **Six room ideas**, each specified as: the obstacle, which body it requires, the
   "aha" the player has, and roughly where it sits in the stage order. Use only the
   obstacle vocabulary above, or extend it with exactly one new rule per room, clearly
   marked. Prefer rooms where the player must change body **twice**, because that is
   where the mechanic gets interesting.
2. **One set-piece** for the Dust King fight that uses the body ladder meaningfully, not
   just as a bigger hitbox.
3. **Three ideas to make the SENSOR earn its place** without making it a second game.
4. **One idea that a jam judge would remember**, given 16 days and one developer.
5. **Three things you think should be cut.** Be blunt.

Keep each idea to a few sentences, name the mechanic it leans on, and say why it is
better than a plain corridor with a wall in it. Do not suggest anything that needs
multiplayer, procedural generation, or a second character.
