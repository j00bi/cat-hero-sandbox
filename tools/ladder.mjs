/* LADDER rooms — the ones built around the SHIFT body mechanic. The 2D autopilot
   in playthrough.mjs cannot drive them (it never changes body), so they are
   proven here instead, the same way ray rooms are proven by ray.mjs. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8123";
const errors = [];
const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(BASE + "/?dev=1", { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}

await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
await page.waitForTimeout(400);

const out = {};
const rooms = await page.evaluate(() => window.__GAME.LEVELS
  .map((L, i) => ({ i, name: L.name, world: L.world, ladder: !!L.ladder }))
  .filter((L) => L.ladder));
out.rooms = rooms;

const place = (i, size, x) => page.evaluate(({ i, size, x }) => {
  const G = window.__GAME;
  G.loadLevel(i);
  G.state.charge = 100;
  if (size !== "normal") G.setSize(size);
  const pl = G.player;
  pl.x = x; pl.y = 470 - pl.h; pl.vx = 0; pl.vy = 0; pl.facing = 1; pl.onGround = true;
  return { size: pl.size, w: pl.w, h: pl.h };
}, { i, size, x });

const walk = async (ms) => {
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(ms);
  await page.keyboard.up("ArrowRight");
  return page.evaluate(() => Math.round(window.__GAME.player.x));
};

const pounce = async () => {
  await page.evaluate(() => { window.__GAME.state.charge = window.__GAME.state.chargeMax; });
  await page.keyboard.down("Shift");
  await page.waitForTimeout(250);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(700);
  return page.evaluate(() => ({
    broken: window.__GAME.world.level.solids.filter((s) => s.broken).length,
    x: Math.round(window.__GAME.player.x),
  }));
};

const roomAt = (w) => rooms.find((r) => r.world === w);
const main = roomAt("2-2") || rooms[0];          // crawl + dust wall
const grateRoom = roomAt("2-1A") || main;        // grate

if (rooms.length) {
  out.roomsTested = [main.world, grateRoom.world].filter((v, i, a) => a.indexOf(v) === i);

  // THE CLIMB must actually contain both kinds of obstacle
  out.shape = await page.evaluate((i) => {
    const L = window.__GAME.LEVELS[i];
    return {
      barriers: L.solids.filter((s) => s.brk).length,
      tall: L.solids.filter((s) => !s.brk && s.y < 380 && s.h > 60).length,
    };
  }, main.i);

  // 1. the crawl stops a normal cat
  await place(main.i, "normal", 955);
  out.crawlNormal = await walk(1400);

  // 2. it admits the half cat
  await place(main.i, "small", 955);
  out.crawlSmall = await walk(1400);

  // 2b. a grate: normal walks over it, the half cat drops through
  const grate = async (size) => {
    await place(grateRoom.i, size, 250);
    await walk(900);
    await page.waitForTimeout(300);
    return page.evaluate(() => ({
      x: Math.round(window.__GAME.player.x),
      y: Math.round(window.__GAME.player.y),
      lives: window.__GAME.state.lives,
    }));
  };
  out.grateNormal = await grate("normal");
  out.grateSmall = await grate("small");

  // 3. the dust wall stops a normal pounce
  await place(main.i, "normal", 3080);
  out.dustNormal = await pounce();

  // 4. and breaks for a double one, opening the way to the goal
  await place(main.i, "big", 3080);
  await pounce();
  out.dustBig = await walk(1200);
  out.dustBigAfter = await page.evaluate(() => ({
    broken: window.__GAME.world.level.solids.filter((s) => s.broken).length,
    mode: window.__GAME.state.mode,
    x: Math.round(window.__GAME.player.x),
  }));
}

/* COUNTER CLIMB: two 96 px steps. Normal's 108 apex climbs, double's 82 cannot. */
const climbRoom = rooms.find((r) => r.world === "2-2A");
if (climbRoom) {
  out.climbShape = await page.evaluate((i) => {
    const L = window.__GAME.LEVELS[i];
    const steps = L.solids.filter((q) => !q.brk && q.h <= 30).map((q) => 470 - q.y).sort((a, b) => a - b);
    return { steps, barriers: L.solids.filter((q) => q.brk).length };
  }, climbRoom.i);

  // The steps only work if the geometry sits between the two bodies' apexes.
  // Measure both from the engine's own constants instead of driving a jump.
  out.climbPhysics = await page.evaluate((i) => {
    const G = window.__GAME;
    const g = 2200;
    const apex = (v) => (v * v) / (2 * g);
    const steps = G.LEVELS[i].solids
      .filter((q) => !q.brk && q.h <= 30).map((q) => 470 - q.y).sort((a, b) => a - b);
    return {
      steps,
      normal: Math.round(apex(G.SZ.normal.jump)),
      big: Math.round(apex(G.SZ.big.jump)),
    };
  }, climbRoom.i);
}

out.checks = {
  hasLadderRoom: rooms.length >= 2,
  roomHasBothObstacles: out.shape && out.shape.barriers >= 1 && out.shape.tall >= 1,
  crawlBlocksNormal: out.crawlNormal < 1000,
  grateHoldsNormal: out.grateNormal.x > 300 && out.grateNormal.y < 470,
  grateDropsHalf: out.grateSmall.y > 470 || out.grateSmall.lives < 3,
  crawlAdmitsSmall: out.crawlSmall > 1180,
  dustBlocksNormal: out.dustNormal && out.dustNormal.broken === 0 && out.dustNormal.x < 3180,
  counterRoomHasTwoSteps: out.climbShape && out.climbShape.steps.join() === "96,192"
    && out.climbShape.barriers === 1,
  normalMountsStep: out.climbPhysics && out.climbPhysics.normal > out.climbPhysics.steps[0],
  doubleCannotMountStep: out.climbPhysics && out.climbPhysics.big < out.climbPhysics.steps[0],
  dustBreaksBig: out.dustBigAfter.broken === 1 &&
    (out.dustBigAfter.x > 3240 || out.dustBigAfter.mode === "clear"),
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
