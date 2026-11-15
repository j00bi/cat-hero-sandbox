# CAT HERO — round 2 brief: engine facts, corrections, and how to spec a room

You gave us four rooms and a boss idea. The design thinking was useful; the coordinates were
written blind to the engine, so they can't be pasted. This document fixes that.

Read it as: *what the game is* (unchanged), *what the engine actually does* (new), *how to
write a spec we can build without translation* (new), and *what we still want* (end).

---

## 1. What you got right

- The physics table: apex 93.1 / 108.2 / 81.8 px and the 96 px counter step are correct for
  our numbers, and the 96 px value is a genuinely good idea. We now build ledges at 96.
- The pounce span (760 × 0.42 = 319 px) is right, and it is the number most room pacing
  depends on.
- **#6 Charge-Starved Gauntlet** is the best thing in the set. It is the only idea that
  connects the charge meter to combat instead of parking them in separate boxes, and it needs
  no new systems.
- The **sensor secret** idea (#3.2) was right and is now implemented.
- The **cut list instinct** was right on the dev panel, and "40% of the campaign abandons the
  core mechanic" is a fair hit even if the percentage isn't.

---

## 2. Corrections — assumptions vs the engine

| you assumed | actually |
|---|---|
| floor at y = 460 | **floor is y = 470** in every room; solids are `{x, y, w, h}` with the ground as `rect(x, 470, w, 90)` |
| perimeter walls at x 0..20, 940..960, ceiling y 0..20 | **no world border.** Rooms are open sky. A level only collides with the solids you list. Off-screen bottom = void = one life. |
| goal is a door 48×64 | **goal is a cushion** at `{x, y}`; the pickup box is `(x−66, y−92, 132×92)`. There is no door entity. |
| vertical shafts are usable | **the camera is horizontal only.** `cam = clamp(player.x − 345.6, 0, level.width − 960)`. Everything is framed in a fixed 960×540 window; there is no Y scroll. Anything above y≈40 is effectively off-screen. |
| a drain pit hazard needs an entity | **a pit is just a hole** in the floor. Falling below y ≈ 740 costs a life and respawns you. |
| standing still is easy | **charge only builds while grounded, not moving (|vx| ≤ 24), and holding SHIFT.** Any movement cancels the crouch and you keep what you banked. This is the heart of #6 and it is stricter than you modelled. |
| a 170 px barrier can sit anywhere | it can, but if its base is above y ≈ 300 the player cannot see what is behind it. Keep required barriers based at floor or platform level, never floating. |

Two of your rooms (#3 pressure plate, #5 fan) also need new systems; the brief said one new
rule per room. We are willing to build **one** new rule per ladder room if the room is strong
enough — we just built "grate" for exactly that reason.

---

## 3. Hard constraints for any room you spec

**Space**
- World units = pixels. Canvas 960×540; rooms run **900–2600 px wide**.
- Ground line y = 470. Useful air: y ≈ 40 … 470.
- Player bodies: half 17×21, normal 34×42, double 68×84. Feet sit at `player.y + h`.
- Jump apex: normal 108, half 93, double 82. **Ledges at most 96 px** unless the room is
  specifically about not reaching.
- Flat jump distance: normal ~170, half ~174, double ~111 px. Gaps above 160 punish double.

**Collision**
- Axis-aligned rectangles only. No slopes, no curves, no one-way platforms except the
  existing moving `platforms` array.
- Flags we already support on a solid: `brk` (dust barrier, only a double-size pounce breaks
  it), `grate` (normal and double walk over it, half drops through).
- The player can always shrink, so a room can never softlock — but it can strand someone if a
  required ledge is only reachable at a size they can't afford (25 charge per shift).

**Camera**
- No vertical framing. Design left-to-right. Don't build a tower.
- The player sees ~345 px behind and ~615 ahead. Anything that must be read *before* you
  commit has to be inside that.

**Pacing budget per room**
- 900–2600 px wide, 6–14 solids, 1–3 enemies (40×28, patrol `min..max` at 70 px/s), one goal.
- A room should be **30–60 seconds** for a first-time player.

**Recharge**
- Charge regenerates 95/s only while standing still. Every room that costs charge must offer
  a **safe, still, recharge spot** — or be deliberately about denying one. Say which you intend.

---

## 4. How to write a spec we can build directly

Give us the room as data in this shape (this is the real schema — anything else needs
translation and risks being built wrong):

```js
{
  world: "2-3", name: "NAME", width: 1500,
  spawn: { x: 80, y: 380 },            // y = 470 - body height
  ladder: true,                         // marks it as mechanic-gated (excluded from autopilot)
  solids: [
    rect(0, 470, 900, 90),              // ground
    rect(900, 470, 600, 90),
    Object.assign(rect(700, 300, 40, 170), { brk: true }),   // dust barrier
    Object.assign(rect(400, 470, 130, 16), { grate: true }), // grate
    rect(1000, 300, 180, 130),          // crawl: bottom at 430 = 40 px headroom
  ],
  coins: [ {x, y}, ... ],
  secrets: [ {x, y} ],                  // only visible under SENSOR
  enemies: [ { x: 600, min: 520, max: 860 } ],
  goal: { x: 1400, y: 470 },
}
```

Rules for using it:
- `rect(x, y, w, h)`: **y is the top edge**, so a ground block is `rect(x, 470, w, 90)`.
- A crawl is a block whose **bottom edge** sits 40 px above the floor: `rect(x, 300, w, 130)`
  (300 + 130 = 430).
- A 96 px step up is a platform `rect(x, 374, w, 24)` (374 + 24 = 398 … i.e. top at 374).
- A dust barrier stands **on** the floor: `rect(x, 300, 40, 170)` (300 + 170 = 470).
- A grate replaces floor, same y as the ground, thin: `rect(x, 470, w, 16)`.

For each room also tell us, in words:
1. **Two-beat body sequence** — e.g. "half under the crawl, then double on the ledge".
2. **The failure state** — what kills you or what you lose if you get the body wrong.
3. **The recharge spot** — where a player is meant to stand and refill, or that there is none
   on purpose.
4. **What the player sees before committing** — the thing that makes the room readable.

---

## 5. Feedback on round 1, idea by idea

**#1 Grate Bridge — buildable, and now partly built.** We added the grate rule because of it.
The room itself is a good opener, but note: a 200 px grate span is wider than a half cat's jump
(174), so the fall is guaranteed — good. Re-spec it with our y values and it can go into 2-1.

**#2 Springboard Kitchen — good idea, wrong framing.** Two 96 px steps work exactly as you
calculated (normal 108 clears, double 82 doesn't). But the barrier on top of Tier 2 at y=98
would be above the visible band; put the barrier at the **top surface of the highest step** and
keep the whole climb inside y ≈ 250..470. The "double jumps lower" insight is the best thing in
this room — keep it.

**#3 Pressure Plate Airlock — the maths is fine, the genre is not.** A 2.6 s timed gate with a
0.41 s margin is a precision-platformer beat, and our cat has 0.25 s of committed, vulnerable
animation in the middle of it. It would feel like a bug, not a puzzle. If you want a timer,
make it generous (4 s+) or drop the timer and make the shutter two-stage.

**#4 Charge-Starved Gauntlet — build this.** Needs no new systems. Two adjustments: the
"no safe ground" claim only holds if the patrol actually reaches everywhere the player could
stand — our enemies walk at 70 px/s, not 140, so widen the patrol or add a second one. And
put the recharge allowance in the spec: the player arrives with whatever they banked.

**Boss set-piece (suction) — strong, and cheap.** A full-room pull is about 40 lines: a
per-frame horizontal force toward the boss scaled by body mass. Double anchors, normal outruns
barely, half gets dragged. Then the stun window forces a shrink to reach the stomp. This uses
everything we have. Keep the "the catch" — it's the good part.

**Cushion rescue ending — the best idea in the message, and the most expensive.** Crawling
inside the dead vacuum and bursting out is exactly the punchline the game needs. It's a
scripted sequence plus a small interior scene. It is worth planning, not worth starting until
the rooms are done.

**Cuts.** Dev panel: agreed, and already handled — the sandbox URL keeps it, a jam bundle won't.
Raycast rooms: we're keeping them; they're 40 seconds each, not 40% of the runtime. Grey skin:
we'll keep the screen but make black the default.

---

## 6. What we want next

1. **Three ladder rooms** in the schema above — one that teaches the grate, one that teaches
   the 96 px counter, one that combines a crawl and a barrier with no safe recharge.
2. **One boss set-piece** for a 3 HP fight where the camera cannot move vertically.
3. **One new rule**, at most, if a room truly needs it — name it, and say what it costs the
   player to use.
4. Anything that uses the SENSOR as *information* rather than a second camera.

Do not spec doors, vertical shafts, slopes, timers under 3 s, or anything that needs a second
character. If a room needs a rule we don't have, mark it **NEW RULE** and put it in one line.
