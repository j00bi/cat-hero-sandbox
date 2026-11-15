/* Ray rooms regression (phase 3).
 *
 * Contract assumed from the game.js <-> ray.js integration:
 *   window.__GAME.RAY                     -> CatRay instance (enter/exit/update/render/release/state/debugTeleport)
 *   window.__GAME.releaseCharge()         -> keyboard/touch charge release; routes to RAY.release() in ray rooms
 *   LEVELS[2] -> 2-3 DUST BIN (ray, dark), LEVELS[3] -> 2-4 THE MOTOR (ray)
 *   LEVELS[4] -> 2-5 THE DEN (boss)
 *
 * Screenshots: shots/15-ray-dustbin.png (charging, light visible).
 * Exits 0 only when every check passes and there are no console/page/HTTP errors.
 */
import { chromium, devices } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8920";
const OUT = new URL("../shots/", import.meta.url);
const CHROME = "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const watch = (page, label) => {
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${label} console: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${label} http ${r.status()} ${r.url()}`); });
};

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
watch(page, "desktop");

await page.goto(BASE + "/", { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}

await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
await page.waitForTimeout(300);

const snapshot = () => page.evaluate(() => {
  const G = window.__GAME;
  const R = G.RAY;
  return {
    mode: G.state.mode,
    level: G.state.level,
    world: G.world.level ? G.world.level.name : null,
    ray: !!(G.world.level && G.world.level.ray),
    x: R ? R.state.x : null,
    y: R ? R.state.y : null,
    charge: G.state.charge,
    chargeMax: G.state.chargeMax,
    doorOpen: R ? R.state.doorOpen : null,
    toys: R ? `${R.state.got}/${R.state.toys.length}` : null,
    boss: !!G.world.boss,
    releaseCharge: typeof G.releaseCharge === "function",
  };
});

const out = { base: BASE };
out.idx = await page.evaluate(() => {
  const f = (w) => window.__GAME.LEVELS.findIndex((L) => L.world === w);
  return { dust: f("2-3"), motor: f("2-4"), boss: f("2-5") };
});
const integration = await page.waitForFunction(
  () => window.__GAME && window.__GAME.RAY && typeof window.__GAME.releaseCharge === "function",
  null, { timeout: 8000 },
).then(() => true).catch(() => false);

out.integration = integration;
if (!integration) {
  out.blocked = "window.__GAME.RAY / window.__GAME.releaseCharge not exposed yet (game.js/index.html integration not live)";
  out.checks = { integration: false, noErrors: errors.length === 0 };
  out.pass = false;
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  process.exit(1);
}

// loadLevel(i) does not touch state.level by itself (normal play does state.level++
// before calling it); mirror the real progression entry.
const load = (target) => page.evaluate((lv) => {
  window.__GAME.state.level = lv;
  window.__GAME.loadLevel(lv);
}, target);

/* 1. DUST BIN starts on the S tile, in play mode, with no page errors. */
await load(await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.world === "2-3")));
await page.waitForTimeout(450);
out.dustStart = await snapshot();
out.artLoaded = await page.waitForFunction(() => {
  const a = window.__GAME.RAY.assets();
  return a.tex >= 7 && a.paws;
}, null, { timeout: 8000 }).then(() => true).catch(() => false);

/* 2. Teleport next to the exit door, let it slide open, then walk forward
      (Space is "forward" in ray rooms) until the room clears. */
await page.evaluate(() => window.__GAME.RAY.debugTeleport(6.3, 6.5, 1, 0));
await page.waitForTimeout(1500);
out.atDoor = await snapshot();
await page.keyboard.down("ShiftLeft");        // light the door for the capture
await page.waitForTimeout(700);
await page.screenshot({ path: new URL("18-ray-door.png", OUT).pathname });
await page.keyboard.up("ShiftLeft");
await page.waitForTimeout(150);
await page.keyboard.down("Space");
out.doorCleared = await page.waitForFunction(
  () => window.__GAME.state.mode === "clear", null, { timeout: 6000 },
).then(() => true).catch(() => false);
await page.keyboard.up("Space");
out.afterDoor = await snapshot();

/* 3. Charging in the dust bin still routes through the shared charge meter;
      screenshot mid-charge so the light circle and arcs are visible. */
await load(await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.world === "2-3")));
await page.waitForTimeout(400);
await page.keyboard.down("ShiftLeft");
await page.waitForTimeout(1150);
out.charging = await snapshot();
await page.screenshot({ path: new URL("15-ray-dustbin.png", OUT).pathname });
await page.keyboard.up("ShiftLeft");
await page.waitForTimeout(150);

/* 4. Frame rate over ~2 s while charging (headless is coarse; report the number). */
await load(await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.world === "2-3")));
await page.waitForTimeout(400);
await page.keyboard.down("ShiftLeft");
out.fps = await page.evaluate(() => new Promise((resolve) => {
  let n = 0;
  const t0 = performance.now();
  (function tick() {
    n++;
    const ms = performance.now() - t0;
    if (ms < 2000) requestAnimationFrame(tick);
    else { resolve(Math.round((n / ms) * 1000 * 10) / 10); }
  })();
}));
await page.keyboard.up("ShiftLeft");

/* 5. THE MOTOR: stand ~1.2 tiles in front of the core facing it, fill the meter,
      release -> blast -> game.js loads stage 4 (the boss). */
await load(await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.world === "2-4")));
await page.waitForTimeout(450);
out.motorStart = await snapshot();
await page.evaluate(() => { window.__GAME.RAY.debugTeleport(3.5, 4.7, 0, -1); });
await page.waitForTimeout(350);
await page.screenshot({ path: new URL("19-ray-motor-core.png", OUT).pathname });
out.motorReleaseApi = await page.evaluate(() => {
  const G = window.__GAME;
  G.state.charge = G.state.chargeMax;
  G.player.charging = true;
  if (typeof G.releaseCharge === "function") G.releaseCharge();
  else return false;
  return true;
});
out.blast = await page.waitForFunction(
  () => window.__GAME.world.boss && !!window.__GAME.world.boss,
  null, { timeout: 5000 },
).then(() => true).catch(() => false);
out.afterBlast = await snapshot();

/* 6. Phone: in the dust bin, held JUMP is "forward" and must move the cat. */
const mctx = await browser.newContext({ ...devices["iPhone 13"] });
const mp = await mctx.newPage();
watch(mp, "mobile");
await mp.goto(BASE + "/", { waitUntil: "networkidle" });
await mp.waitForFunction(() => window.__GAME && window.__GAME.RAY, null, { timeout: 10000 });
await mp.waitForTimeout(300);
await mp.evaluate(() => { const i = window.__GAME.LEVELS.findIndex((L) => L.world === "2-3"); window.__GAME.state.level = i; window.__GAME.loadLevel(i); });
await mp.waitForTimeout(400);
out.mobileStart = await mp.evaluate(() => {
  const G = window.__GAME;
  return { mode: G.state.mode, x: G.RAY.state.x, y: G.RAY.state.y };
});
await mp.locator('[data-k="jump"]').dispatchEvent("pointerdown");
await mp.waitForTimeout(1000);
await mp.locator('[data-k="jump"]').dispatchEvent("pointerup");
out.mobileEnd = await mp.evaluate(() => {
  const G = window.__GAME;
  return { mode: G.state.mode, x: G.RAY.state.x, y: G.RAY.state.y };
});
out.mobileMoved = Math.hypot(out.mobileEnd.x - out.mobileStart.x, out.mobileEnd.y - out.mobileStart.y);
await mctx.close();

const near = (a, b, tol) => Math.abs(a - b) <= tol;
out.checks = {
  integration: out.integration && out.dustStart.releaseCharge,
  dustStartS: out.dustStart.mode === "play" && out.dustStart.ray
    && out.dustStart.level === out.idx.dust && out.dustStart.world === "DUST BIN"
    && near(out.dustStart.x, 1.5, 0.35) && near(out.dustStart.y, 1.5, 0.35),
  doorOpens: out.atDoor.doorOpen === true,
  doorClears: out.doorCleared && out.afterDoor.mode === "clear",
  artLoaded: out.artLoaded,
  doorScreenshot: fs.existsSync(new URL("18-ray-door.png", OUT)),
  motorScreenshot: fs.existsSync(new URL("19-ray-motor-core.png", OUT)),
  chargeFull: out.charging.charge === 100,
  chargeScreenshot: fs.existsSync(new URL("15-ray-dustbin.png", OUT)),
  fps50: out.fps >= 50,
  motorRoom: out.motorStart.mode === "play" && out.motorStart.ray
    && out.motorStart.level === out.idx.motor && out.motorStart.world === "THE MOTOR",
  blastAdvances: out.blast && out.afterBlast.level === out.idx.boss && out.afterBlast.boss,
  mobileMoves: out.mobileStart.mode === "play" && out.mobileMoved > 0.3,
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
