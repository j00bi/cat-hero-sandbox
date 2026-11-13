/* SENSOR — hold TAB. Proves the schematic opens, that you cannot act while it is
   up, that it closes cleanly, and that it stays out of the raycaster rooms. */
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
const start = (i = 0) => page.evaluate((i) => {
  const G = window.__GAME;
  G.state.mode = "play";
  G.loadLevel(i);
  G.setMap(false);
  return { level: G.world.level.name, x: Math.round(G.player.x) };
}, i);

// 1. opens and paints
out.before = await start(0);
await page.keyboard.down("Tab");
await page.waitForTimeout(450);
out.opened = await page.evaluate(() => window.__GAME.mapView.on);
out.ink = await page.evaluate(() => {
  const c = document.querySelector("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let dark = 0, mint = 0, n = d.length / 4;
  for (let k = 0; k < d.length; k += 4) {
    if (d[k] + d[k + 1] + d[k + 2] < 90) dark++;
    if (d[k + 1] > 200 && d[k] < 180 && d[k + 2] > 150) mint++;
  }
  return { darkPct: (100 * dark) / n, mint };
});

// 2. looking is not acting
const x0 = await page.evaluate(() => Math.round(window.__GAME.player.x));
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(700);
await page.keyboard.up("ArrowRight");
const x1 = await page.evaluate(() => Math.round(window.__GAME.player.x));
out.frozen = { x0, x1 };

// 3. releases cleanly
await page.keyboard.up("Tab");
await page.waitForTimeout(300);
out.closed = await page.evaluate(() => window.__GAME.mapView.on);
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(700);
await page.keyboard.up("ArrowRight");
out.resumed = await page.evaluate(() => Math.round(window.__GAME.player.x));

// 4. never over a raycaster room
out.rayRefused = await page.evaluate(() => {
  const G = window.__GAME;
  const i = G.LEVELS.findIndex((L) => L.ray);
  G.state.mode = "play";
  G.loadLevel(i);
  return { on: G.setMap(true), ray: !!G.world.level.ray };
});

out.checks = {
  opens: out.opened === true,
  paints: out.ink.darkPct > 60 && out.ink.mint > 200,
  freezesTheCat: Math.abs(out.frozen.x1 - out.frozen.x0) < 6,
  releasesCleanly: out.closed === false,
  movementResumes: out.resumed - out.frozen.x1 > 60,
  staysOutOfRayRooms: out.rayRefused.on === false && out.rayRefused.ray === true,
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
