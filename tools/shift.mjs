/* SHIFT — the size ladder. Proves the three bodies, the meter cost, the headroom
   rule, the crawl tunnel, and that nothing leaks across a respawn. */
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
const idx = await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.sandbox));

const place = (size) => page.evaluate(({ size, idx }) => {
  const G = window.__GAME;
  G.loadLevel(idx);
  G.state.charge = 100;
  G.setSize(size);
  const pl = G.player;
  pl.x = 800; pl.y = 470 - pl.h; pl.vx = 0; pl.vy = 0; pl.onGround = true;
  return { size: pl.size, w: pl.w, h: pl.h, charge: G.state.charge };
}, { size, idx });

const walk = async (ms = 1600) => {
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(ms);
  await page.keyboard.up("ArrowRight");
  return page.evaluate(() => Math.round(window.__GAME.player.x));
};

// 1. three bodies
out.small = await place("small");
out.normal = await place("normal");
out.big = await place("big");

// 2. the meter pays for it
await page.evaluate((idx) => { const G = window.__GAME; G.loadLevel(idx); G.state.charge = 0; }, idx);
out.refusedWhenEmpty = await page.evaluate(() => window.__GAME.shiftSize(1) === false);
await page.evaluate((idx) => { const G = window.__GAME; G.loadLevel(idx); G.state.charge = 100; }, idx);
out.spendsCharge = await page.evaluate(() => {
  const G = window.__GAME, before = G.state.charge;
  const ok = G.shiftSize(1);
  return { ok, spent: before - G.state.charge, size: G.player.size };
});

// 3. no headroom, no growing — park under the crawl ceiling
out.headroomRefused = await page.evaluate((idx) => {
  const G = window.__GAME;
  G.loadLevel(idx);
  G.state.charge = 100;
  G.player.x = 960; G.player.y = 449; G.player.w = 17; G.player.h = 21; G.player.size = "small";
  const ok = G.setSize("big");
  return { ok, size: G.player.size };
}, idx);

// 4. the tunnel: only half gets through
out.tunnel = {};
await place("normal"); out.tunnel.normal = await walk();
await place("small");  out.tunnel.small = await walk();
await place("big");    out.tunnel.big = await walk();

// 5. death resets the body
out.respawn = await page.evaluate((idx) => {
  const G = window.__GAME;
  G.loadLevel(idx);
  G.state.charge = 100;
  G.setSize("big");
  G.hurt(true);
  return { size: G.player.size, w: G.player.w, h: G.player.h };
}, idx);

// 6. tap SHIFT cycles the body; a full meter still casts instead
out.tap = await page.evaluate(() => {
  const G = window.__GAME;
  const i = G.LEVELS.findIndex((L) => L.sandbox);
  G.loadLevel(i); G.state.charge = 60; G.setSize("normal");
  return { size: G.player.size, charge: G.state.charge };
});
await page.keyboard.down("Shift");
await page.waitForTimeout(60);
await page.keyboard.up("Shift");
await page.waitForTimeout(200);
out.tapped = await page.evaluate(() => ({ size: window.__GAME.player.size, charge: window.__GAME.state.charge }));

// 7. dust barrier: only a double-size pounce breaks it
const barrier = async (size) => {
  await page.evaluate(({ size }) => {
    const G = window.__GAME;
    const i = G.LEVELS.findIndex((L) => L.sandbox);
    G.loadLevel(i); G.state.charge = 100; G.setSize(size);
    const pl = G.player;
    pl.x = 1560; pl.y = 470 - pl.h; pl.vx = 0; pl.vy = 0; pl.facing = 1;
    G.state.charge = G.state.chargeMax;
  }, { size });
  await page.keyboard.down("Shift");
  await page.waitForTimeout(250);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(700);
  return page.evaluate(() => ({
    broken: window.__GAME.world.level.solids.filter((s) => s.broken).length,
    x: Math.round(window.__GAME.player.x),
  }));
};
out.barrierBig = await barrier("big");
out.barrierNormal = await barrier("normal");

out.checks = {
  threeBodies: out.small.w === 17 && out.small.h === 21
    && out.normal.w === 34 && out.normal.h === 42
    && out.big.w === 68 && out.big.h === 84,
  meterGates: out.refusedWhenEmpty === true,
  spendsTheMeter: out.spendsCharge.ok && out.spendsCharge.spent === 25 && out.spendsCharge.size === "big",
  headroomRule: out.headroomRefused.ok === false && out.headroomRefused.size === "small",
  tunnelBlocksNormal: out.tunnel.normal < 880 && out.tunnel.big < 880,
  tunnelAdmitsSmall: out.tunnel.small > 1100,
  respawnResets: out.respawn.size === "normal" && out.respawn.w === 34 && out.respawn.h === 42,
  tapShiftCycles: out.tap.size === "normal" && out.tapped.size === "big",
  bigBreaksDust: out.barrierBig.broken === 1 && out.barrierBig.x > 1700,
  normalBouncesOffDust: out.barrierNormal.broken === 0 && out.barrierNormal.x < 1620,
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
