/* Story flow: title -> select -> opening cards -> stage 1, and the ending card
   after the last demo stage resolves to the win screen. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";

const OUT = new URL("../shots/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const BASE = process.env.BASE || "http://127.0.0.1:8920";
const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });

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
  const { state, LEVELS, DEMO_COUNT, world } = window.__GAME;
  return { mode: state.mode, level: state.level, card: state.card ? { i: state.card.i, n: state.card.lines.length } : null,
           levels: LEVELS.length, demo: DEMO_COUNT, world: world.level ? world.level.name : null,
           ray: !!(world.level && world.level.ray), placeholder: !!(world.level && world.level.placeholder) };
});
const confirmUntil = async (mode, max = 16) => {
  for (let i = 0; i < max; i++) {
    if ((await snapshot()).mode === mode) return true;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(130);
  }
  return (await snapshot()).mode === mode;
};

const out = { start: await snapshot() };
await page.keyboard.press("Enter");                       // title -> select
await page.waitForTimeout(250);
out.select = await snapshot();
await page.keyboard.press("Enter");                       // select -> opening card
await page.waitForTimeout(250);
out.opening = await snapshot();
await page.screenshot({ path: new URL("12-story-opening.png", OUT).pathname });

out.openingToPlay = await confirmUntil("play");
out.atStage1 = await snapshot();

// Walk the actual progression. Ray stages are real rooms now, but this test
// deliberately does not solve them: force "clear", then let Enter advance.
const clearHere = async () => {
  await page.evaluate(() => { window.__GAME.state.mode = "clear"; });
  await page.waitForTimeout(120);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(260);
  return snapshot();
};
out.stage1b = await clearHere();      // GRATE & PIPE loads (ladder)
out.stage2 = await clearHere();       // THE CLIMB loads (ladder)
out.stage3 = await clearHere();       // DUST BIN loads (ray)
out.stage4 = await clearHere();       // THE MOTOR loads (ray)
out.stage5 = await clearHere();       // THE DEN loads (boss)
await page.evaluate(() => { window.__GAME.state.mode = "clear"; });
await page.waitForTimeout(120);
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
out.ending = await snapshot();
await page.screenshot({ path: new URL("13-story-ending.png", OUT).pathname });
out.endingToWin = await confirmUntil("win");
out.final = await snapshot();

out.checks = {
  select: out.select.mode === "select",
  opening: out.opening.mode === "card" && out.opening.card.n === 3,
  openingToPlay: out.openingToPlay,
  stage1: out.atStage1.level === 0 && out.atStage1.world === "BACKYARD",
  stage1b: out.stage1b.world === "GRATE & PIPE" && out.stage1b.mode === "play",
  stage2: out.stage2.world === "THE CLIMB" && out.stage2.mode === "play",
  ray3: out.stage3.world === "DUST BIN"
    && out.stage3.ray && out.stage3.mode === "play",
  ray4: out.stage4.world === "THE MOTOR"
    && out.stage4.ray && out.stage4.mode === "play",
  boss: out.stage5.world === "THE DEN" && out.stage5.mode === "play",
  counts: out.start.demo >= 5,
  ending: out.ending.mode === "card" && out.ending.card.n === 3,
  endingToWin: out.endingToWin,
  win: out.final.mode === "win",
  noErrors: errors.length === 0,
};
out.pass = out.checks.select
  && out.opening.mode === "card" && out.opening.card.n === 3
  && out.openingToPlay && out.atStage1.level === 0 && out.atStage1.world === "BACKYARD"
  && out.checks.stage1b && out.checks.stage2 && out.checks.ray3 && out.checks.ray4 && out.checks.boss
  && out.start.demo >= 5 && out.start.levels > out.start.demo
  && out.ending.mode === "card" && out.ending.card.n === 3
  && out.endingToWin && out.final.mode === "win"
  && errors.length === 0;
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
