/* Phase 4 transition beats.
   1. Vacuum swallow: idle -> swallowing -> eaten, dragged in over several frames,
      with a flash/shake/reaction, and cancelled by death and by a level reload.
   2. Motor blast handoff: held white -> boss room swapped in once, cat airborne
      (introBlast pose), one flash only, then the new room is revealed. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8124";
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
watch(page, "main");
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

/* ------------------------------------------------------------- 1. swallow */
await page.evaluate(() => {
  const G = window.__GAME;
  G.jumpToStage(0);
  G.player.x = G.world.vac.trigger - 40;   // just short of the trigger
  G.player.vx = 0;
});
await page.waitForTimeout(120);
out.vacIdle = await page.evaluate(() => {
  const v = window.__GAME.world.vac;
  return { phase: v.phase, toyEaten: v.toyEaten, started: v.started };
});

// start sampling before the trigger is crossed, so idle is captured too
const swallowSample = page.evaluate((startX) => new Promise((resolve) => {
  const G = window.__GAME;
  const v = G.world.vac;
  const frames = [];
  const t0 = performance.now();
  let crossed = false, eaten = null;
  (function tick() {
    const now = performance.now();
    if (!crossed && now - t0 > 120) { G.player.x = startX; G.player.vx = 0; crossed = true; }
    if (v) {
      const last = frames[frames.length - 1];
      if (!last || last.phase !== v.phase) {
        frames.push({ phase: v.phase, t: Math.round(now - t0), x: Math.round(v.x), phaseT: +v.phaseT.toFixed(3) });
      }
      if (v.phase === "eaten" && !eaten) {
        eaten = { t: Math.round(now - t0), toyEaten: v.toyEaten,
                  flash: +G.state.flash.toFixed(2), shake: +G.state.shake.toFixed(1),
                  react: +G.player.react.toFixed(2), vacuumX: Math.round(v.x) };
      }
    }
    if (eaten || now - t0 > 6000) return resolve({ frames, eaten });
    requestAnimationFrame(tick);
  })();
}), await page.evaluate(() => window.__GAME.world.vac.trigger + 2));
await page.waitForFunction(() => window.__GAME.world.vac && window.__GAME.world.vac.phase === "swallowing",
  null, { timeout: 3000 });
await page.screenshot({ path: new URL("20-transition-swallow.png", OUT).pathname });
out.swallow = await swallowSample;

// Death cancels: start the beat again, fall in a pit mid-swallow.
await page.evaluate(() => {
  const G = window.__GAME;
  G.jumpToStage(0);
  G.player.x = G.world.vac.trigger + 2;
  G.player.vx = 0;
});
await page.waitForFunction(() => window.__GAME.world.vac.phase === "swallowing", null, { timeout: 3000 });
out.livesBeforeDeathCancel = await page.evaluate(() => window.__GAME.state.lives);
await page.evaluate(() => { window.__GAME.player.y = 900; window.__GAME.player.vy = 400; });
await page.waitForTimeout(300);
out.deathCancel = await page.evaluate(() => {
  const G = window.__GAME;
  const v = G.world.vac;
  return { lives: G.state.lives, phase: v.phase, started: v.started, toyEaten: v.toyEaten };
});

// Level reload cancels: start again, reload mid-swallow.
await page.evaluate(() => {
  const G = window.__GAME;
  G.jumpToStage(0);
  G.player.x = G.world.vac.trigger + 2;
  G.player.vx = 0;
});
await page.waitForFunction(() => window.__GAME.world.vac.phase === "swallowing", null, { timeout: 3000 });
await page.evaluate(() => window.__GAME.jumpToStage(0));
await page.waitForTimeout(120);
out.reloadCancel = await page.evaluate(() => {
  const v = window.__GAME.world.vac;
  return { phase: v.phase, started: v.started, toyEaten: v.toyEaten };
});

/* --------------------------------------------------------------- 2. blast */
out.motorIdx = await page.evaluate(() => window.__GAME.LEVELS.findIndex((L) => L.world === "2-4"));
await page.evaluate(() => {
  const G = window.__GAME;
  G.jumpToStage(G.LEVELS.findIndex((L) => L.world === "2-4"));   // THE MOTOR
  G.state.charge = G.state.chargeMax;
  G.player.charging = true;
});
await page.waitForTimeout(350);
await page.evaluate(() => {
  const G = window.__GAME;
  G.RAY.debugTeleport(3.5, 4.7, 0, -1);  // 1.2 tiles below the core, facing it
});
await page.waitForTimeout(150);

// Sample the handoff from the moment the release fires until it is gone.
out.blast = await page.evaluate(() => new Promise((resolve) => {
  const G = window.__GAME;
  const levels = [G.state.level];
  let sawBlast = false, sawHandoff = false, sawSwap = null, maxAlpha = 0;
  let swapFlash = null, swapLevelAtHold = null, finished = false;
  const t0 = performance.now();
  G.state.charge = G.state.chargeMax;
  G.player.charging = true;
  G.releaseCharge();

  (function tick() {
    const h = G.state.handoff;
    if (G.state.level !== levels[levels.length - 1]) levels.push(G.state.level);
    if (G.RAY.state && G.RAY.state.blast && !sawBlast) sawBlast = true;
    if (h) {
      sawHandoff = true;
      maxAlpha = Math.max(maxAlpha, h.alpha);
      if (!h.swapped) swapLevelAtHold = G.state.level;
      if (h.swapped && !sawSwap) {
        const boss = G.world.boss;
        sawSwap = {
          level: G.state.level,
          world: G.world.level && G.world.level.world,
          airborne: G.player.vy < 0 && G.player.y === 120 && G.player.x === 200,
          vy: G.player.vy,
          boss: !!boss,
          bossState: boss && boss.state,
          bossStun: boss && +boss.stun.toFixed(2),
          flash: +G.state.flash.toFixed(2),
          alpha: +h.alpha.toFixed(2),
        };
      }
      if (h.swapped) swapFlash = G.state.flash;
    }
    if (sawHandoff && !h) finished = true;
    if (finished || performance.now() - t0 > 6000) {
      resolve({ sawBlast, sawHandoff, maxAlpha: +maxAlpha.toFixed(2), swapLevelAtHold,
                sawSwap, swapFlash: swapFlash === null ? null : +swapFlash.toFixed(2),
                levels, finished, levelAfter: G.state.level,
                pendingHandoff: !!G.state.handoff });
      return;
    }
    requestAnimationFrame(tick);
  })();
}));
await page.waitForTimeout(600);         // nothing may rebuild the room afterwards
out.blastAfter = await page.evaluate(() => {
  const G = window.__GAME;
  return { level: G.state.level, world: G.world.level && G.world.level.world,
           boss: !!G.world.boss, handoff: !!G.state.handoff,
           mode: G.state.mode, flash: G.state.flash };
});
await page.screenshot({ path: new URL("21-transition-blast-room.png", OUT).pathname });

out.errors = errors;
out.checks = {
  startsIdle: out.vacIdle.phase === "idle" && !out.vacIdle.toyEaten && !out.vacIdle.started,
  phaseOrder: JSON.stringify(out.swallow.frames.map((f) => f.phase).filter((p, i, a) => a.indexOf(p) === i))
    === JSON.stringify(["idle", "swallowing", "eaten"]),
  dragIsAFewFrames: out.swallow.frames.length === 3
    && out.swallow.frames[2].t - out.swallow.frames[1].t >= 200,
  lungeMoves: out.swallow.eaten && out.swallow.frames[1].x - out.swallow.eaten.vacuumX > 80,
  cushionEaten: out.swallow.eaten && out.swallow.eaten.toyEaten,
  beatSells: out.swallow.eaten && out.swallow.eaten.flash > 0 && out.swallow.eaten.shake > 0
    && out.swallow.eaten.react > 0,
  deathCancels: out.deathCancel.lives === out.livesBeforeDeathCancel - 1
    && out.deathCancel.started === false && out.deathCancel.phase === "idle" && !out.deathCancel.toyEaten,
  reloadCancels: out.reloadCancel.phase === "idle" && out.reloadCancel.started === false
    && !out.reloadCancel.toyEaten,
  blastStarts: out.blast.sawBlast && out.blast.sawHandoff,
  holdsWhiteBeforeSwap: out.blast.swapLevelAtHold === out.motorIdx && out.blast.maxAlpha >= 0.99,
  swapsOnceToBoss: JSON.stringify(out.blast.levels) === JSON.stringify([out.motorIdx, out.motorIdx + 1])
    && out.blast.sawSwap && out.blast.sawSwap.level === out.motorIdx + 1
    && out.blast.sawSwap.world === "2-5" && out.blast.sawSwap.boss,
  introBlastPose: out.blast.sawSwap && out.blast.sawSwap.airborne
    && out.blast.sawSwap.bossState === "stun" && out.blast.sawSwap.bossStun === 3,
  noDoubleFlash: out.blast.sawSwap && out.blast.sawSwap.flash === 0
    && out.blast.sawSwap.alpha >= 0.99 && out.blast.swapFlash === 0,
  handoffEnds: out.blast.finished && !out.blast.pendingHandoff
    && out.blast.levelAfter === out.motorIdx + 1 && out.blastAfter.boss
    && out.blastAfter.level === out.motorIdx + 1,
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
