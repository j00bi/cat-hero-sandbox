# CAT HERO — round 3: feedback on your specs

Good round. You used our schema, our y-axis, our 96 px step and our pounce span, and two of
the three rooms are close to buildable. Below are the things that would stop them being built,
then the facts you're still modelling wrong, then what to send next.

---

## 1. Blocking errors (fix these before anything else)

**E1 — Room A's secret is unreachable.** `{ x: 790, y: 268 }` sits above the crawl block whose
top surface is y = 300. From the floor your apex is feet-at-362 (normal, 108 px). From the
shelf at x 1040..1180 (top 374) the apex is feet-at-266 — high enough — but the secret is
**250 px away and the flat jump is 170**. Nothing in the room reaches it.
Fix: move it to `{ x: 790, y: 330 }` (inside the crawl, chest height) so it is a reward for
committing to half, or add a two-step chain that actually arrives there.

**E2 — Room B has a solid outside the world.** `rect(560, 620, 140, 40)` is below the canvas
(540 tall); it can never be touched and would never be drawn. It's also nowhere near the actual
gap, which is at x 950..1020. Delete it, or move the drop-catch to `rect(x, 500, w, 30)`
cut in under the step's edge.

**E3 — Two of the three rooms delete something we can't spare.**
- Room A is `world: "2-1"` — that's BACKYARD, and it is currently **the only room the
  autopilot suite can solve**. Marking it `ladder: true` leaves that suite with zero rooms to
  cover. Any plan that makes every campaign room ladder-gated needs to say where the plain
  platforming coverage comes from.
- Room C is `world: "2-4"` — that's THE MOTOR, a first-person duct room. Converting it drops
  a whole perspective section.
Say **NEW ROOM** or **REPLACE 2-x** on each spec. We would rather build three new rooms than
overwrite three that work.

**E4 — The specs never say what happens to the room's existing content.** Coins, decor,
enemies, story beats, and where the room sits in the night-shift arc. One line each is enough.

**E5 — Room C is unfair in one specific way.** The pounce runway coins at x 740..820 sit inside
enemy B's patrol (650..910), so collecting them is contact damage, not a choice. Either move
them behind the barrier or say out loud that they're bait.

**E6 — The boss pull has no numbers.** "Pulled inward faster than its run speed" isn't
buildable. Give us: force in px/s², the per-body multiplier (half / normal / double), whether
"anchor" means zero acceleration or strong drag, and the radius where the pull starts. Also say
whether the pull is on while the boss is charging or only while it parks.

---

## 2. Facts you're still modelling wrong

- **Stomp works at every size.** You assume twice that half can't stomp. It currently can —
  `SZ.stomp` exists in the table but is not wired to combat. If a room depends on half being
  harmless, mark it **NEW RULE**; if not, drop the assumption.
- **Enemies ground-snap** to the top of whatever solid is under them and reverse on walls.
  Your perch at y = 374 vs enemy top at 442 is correct, and it will hold.
- **The goal pickup box is 132 × 92 above the goal point.** Nothing solid may sit within
  ~70 px of a goal or it can shadow the pickup.
- **Enemies move at 70 px/s**, not 140. Your Room C patrol timings assume double that; a
  460 px patrol takes 6.6 s, not 3.3 s, which makes "no safe recharge" easier than you think.
- **Rooms are 900–2600 px wide** and the camera shows 960. Your 1280 boss arena and 1650 rooms
  are both fine.

---

## 3. Design notes, where you're right and where to push

**Room B is the best geometry in the set.** Two 96 px steps with the dust barrier on the top
deck is exactly the beat the ladder was missing: you must climb as normal, *then* become the
thing that breaks the wall. Keep it. The only reason it isn't built yet is E3.

**Room C is strong but tight.** Overlapping patrols, contact damage, 25 charge per shift and no
safe floor is a lot for a first-time player at the 80% mark. The perch is the mercy — good —
but make it visibly a perch (a coin on top, as you did) and consider letting it be reachable
from either side so panic doesn't trap them.

**Room A is a great opener with one flaw.** The 200 px grate is correct maths (half's flat jump
is 174) and teaching "shrinking has a cost" before "shrinking is useful" is the right order.
It just needs to be a new first room rather than overwriting the tutorial.

**The fragile rule is the right kind of new rule** — it punishes staying big after a break.
But do not put it over the void: a life lost to a mandatory pounce reads as unfair. Put the
fragile boards over a lower shelf, so the punishment is time and 25 charge, not a death.

**The boss set-piece is the right shape.** Pull, mass decides, stun lands on a 96 px shelf that
only normal reaches. That is the whole mechanic in one fight. It needs numbers (E6) and a
decision about which of the two side counters is the landing one, so the player can pre-position.

**Your SENSOR ideas are good and cheap.** The green/red clearance ghost is the best of the
three — fizzles currently look like a bug, and that box would explain them in one glance. The
hatching for grate vs floor is a close second. The boss trajectory line depends on the boss
having a deterministic rebound; if we build that, the line comes free.

---

## 4. What to send next

Three rooms, each labelled **NEW ROOM** or **REPLACE 2-x**, in the schema, plus these four
lines per room:

1. body sequence (two beats minimum),
2. failure state,
3. where the player is meant to stand still and recharge — or "none, on purpose",
4. what the player can see before committing.

Plus, separately:

- the boss pull with real numbers and the light/heavy multipliers,
- whether the clearance ghost is worth building before the rooms or after,
- and one line telling us which room you'd cut if we only had time for two.

Nothing above y = 40 or below y = 540. No doors, no vertical shafts, no slopes. If a room
needs something we don't have, one line marked **NEW RULE** and what it costs the player.
