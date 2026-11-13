/* Capture every screen of the game at a known canvas origin, so colour and
   contrast can be sampled with PIL instead of guessed. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";

const OUT = new URL("../shots/restyle/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://127.0.0.1:8911/";

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}

await page.waitForFunction(() => window.__GAME);
await page.waitForTimeout(400);

const box = await page.evaluate(() => {
  const r = document.getElementById("game").getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});

const shot = async (name) => {
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname });
  return name;
};

const taken = [];
taken.push(await shot("01-title"));

await page.keyboard.press("Enter");
await page.waitForTimeout(400);
taken.push(await shot("02-select"));

await page.keyboard.press("Enter");
await page.waitForTimeout(900);
taken.push(await shot("03-play"));

// clear card
await page.evaluate(() => { const G = window.__GAME; G.state.mode = "clear"; G.state.coins = 7; });
await page.waitForTimeout(200);
taken.push(await shot("04-clear"));

// game over
await page.evaluate(() => { const G = window.__GAME; G.state.mode = "gameover"; G.state.coins = 12; });
await page.waitForTimeout(200);
taken.push(await shot("05-gameover"));

// win
await page.evaluate(() => { const G = window.__GAME; G.state.mode = "win"; G.state.fish = 34; G.state.best = 34; });
await page.waitForTimeout(200);
taken.push(await shot("06-win"));

// boss room
await page.evaluate(() => {
  const G = window.__GAME;
  G.loadLevel(G.LEVELS.findIndex((L) => L.boss));
  G.player.x = 240; G.player.y = 300;
});
await page.waitForTimeout(700);
taken.push(await shot("07-boss"));

// boss stunned (the moment the fight is readable)
await page.evaluate(() => {
  const G = window.__GAME; const b = G.world.boss;
  b.state = "stun"; b.stun = 9; b.x = 540; G.player.x = 540; G.player.y = 310;
});
await page.waitForTimeout(300);
taken.push(await shot("08-boss-stun"));

console.log(JSON.stringify({ canvas: box, shots: taken, errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
