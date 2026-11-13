/* Sandbox stage-skip panel: appears only with ?dev=1, jumps to any demo stage,
   advances/restarts, and hides via the close button / backquote. */
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
watch(page, "dev");
await page.goto(BASE + "/?dev=1", { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}

await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
await page.waitForTimeout(400);

const state = () => page.evaluate(() => {
  const G = window.__GAME;
  return { mode: G.state.mode, level: G.state.level, world: G.world.level ? G.world.level.name : null,
           ray: document.body.classList.contains("ray"), boss: !!G.world.boss,
           panel: !document.getElementById("sandbox").hidden,
           openBtn: !document.getElementById("sb-open").hidden,
           active: [...document.querySelectorAll("#sb-stages button")]
             .filter((b) => b.classList.contains("active")).map((b) => b.dataset.stage),
           label: document.getElementById("sb-now").textContent };
});
const out = { boot: await state() };
const click = (sel) => page.locator(sel).click();
const settle = () => page.waitForTimeout(300);

await click('#sb-stages button[data-stage="2"]'); await settle();
out.dust = await state();
out.focusAfterClick = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
await page.screenshot({ path: new URL("16-sandbox-panel.png", OUT).pathname });
await click('[data-sb="next"]'); await settle();
out.motor = await state();
await click('[data-sb="next"]'); await settle();
out.boss = await state();
await click('[data-sb="restart"]'); await settle();
out.restart = await state();
await click('#sb-stages button[data-stage="0"]'); await settle();
out.backyard = await state();

// hide via the close button, reopen via the DEV pill, then toggle with backquote
await click("#sb-close"); await settle();
out.closed = await state();
await click("#sb-open"); await settle();
out.reopened = await state();
await page.keyboard.press("Backquote"); await settle();
out.keyHidden = await state();
await page.keyboard.press("Backquote"); await settle();
out.keyShown = await state();

// production URL: the panel must not exist/visible
const prod = await browser.newPage({ viewport: { width: 900, height: 700 } });
watch(prod, "prod");
await prod.goto(BASE + "/", { waitUntil: "networkidle" });
await prod.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
out.prod = await prod.evaluate(() => ({
  panel: !document.getElementById("sandbox").hidden,
  openBtn: !document.getElementById("sb-open").hidden,
}));

// phone: tap a stage card and next
const mctx = await browser.newContext({ ...devices["iPhone 13"] });
const mp = await mctx.newPage();
watch(mp, "mobile");
await mp.goto(BASE + "/?dev=1", { waitUntil: "networkidle" });
await mp.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
await mp.waitForTimeout(400);
await mp.locator('#sb-stages button[data-stage="3"]').tap();
await mp.waitForTimeout(300);
out.mobileMotor = await mp.evaluate(() => ({ level: window.__GAME.state.level, world: window.__GAME.world.level.name }));
await mp.locator('[data-sb="next"]').tap();
await mp.waitForTimeout(300);
out.mobileBoss = await mp.evaluate(() => ({ level: window.__GAME.state.level, world: window.__GAME.world.level.name, boss: !!window.__GAME.world.boss }));

// transition beats: one tap each, no walking
await mp.locator('[data-sb="beat-swallow"]').tap();
await mp.waitForTimeout(350);
out.beatSwallow = await mp.evaluate(() => ({
  world: window.__GAME.world.level.name,
  vac: !!window.__GAME.world.vac,
  ahead: window.__GAME.world.vac ? Math.round(window.__GAME.world.vac.trigger - window.__GAME.player.x) : null,
}));
await mp.locator('[data-sb="beat-blast"]').tap();
await mp.waitForTimeout(350);
out.beatBlast = await mp.evaluate(() => ({
  world: window.__GAME.world.level.name,
  motor: !!(window.__GAME.RAY && window.__GAME.RAY.state && window.__GAME.RAY.state.motor),
  // one tap should fire the overload, not just load it
  fired: !!(window.__GAME.RAY && window.__GAME.RAY.state && window.__GAME.RAY.state.blast),
}));
await mp.screenshot({ path: new URL("17-sandbox-mobile.png", OUT).pathname });
await mctx.close();

out.checks = {
  panelVisibleInDev: out.boot.panel && !out.boot.openBtn,
  buttonsReleaseFocus: out.focusAfterClick !== "BUTTON",
  jumpsToDust: out.dust.level === 2 && out.dust.world === "DUST BIN" && out.dust.mode === "play" && out.dust.ray,
  nextToMotor: out.motor.level === 3 && out.motor.world === "THE MOTOR" && out.motor.ray,
  nextToBoss: out.boss.level === 4 && out.boss.world === "THE DEN" && out.boss.boss && !out.boss.ray,
  restartKeepsBoss: out.restart.level === 4 && out.restart.mode === "play" && out.restart.boss,
  jumpsToBackyard: out.backyard.level === 0 && out.backyard.world === "BACKYARD" && !out.backyard.ray,
  hidesAndReopens: !out.closed.panel && out.closed.openBtn && out.reopened.panel,
  backquoteToggles: !out.keyHidden.panel && out.keyShown.panel,
  prodHidden: !out.prod.panel && !out.prod.openBtn,
  mobileWorks: out.mobileMotor.level === 3 && out.mobileMotor.world === "THE MOTOR"
    && out.mobileBoss.level === 4 && out.mobileBoss.boss,
  beatSwallowWorks: out.beatSwallow.vac && out.beatSwallow.ahead > 100 && out.beatSwallow.ahead < 260,
  beatBlastWorks: out.beatBlast.motor && out.beatBlast.fired && out.beatBlast.world === "THE MOTOR",
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
