import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";

const OUT = new URL("../shots/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });

await page.goto((process.env.BASE || "http://127.0.0.1:8123") + "/", { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}

await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });
await page.waitForTimeout(400);

const advanceCards = async () => {
  for (let i = 0; i < 12; i++) {
    const mode = await page.evaluate(() => window.__GAME.state.mode);
    if (mode !== "card") return mode;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(140);
  }
  return page.evaluate(() => window.__GAME.state.mode);
};

const g = () => page.evaluate(() => {
  const { state, player, world } = window.__GAME;
  return { mode: state.mode, x: player.x, y: player.y, vy: player.vy, onGround: player.onGround,
           anim: player.anim, lives: state.lives, coins: state.coins, enemies: world.enemies.filter(e => e.alive).length,
           goal: world.goal ? world.goal.x : null, level: state.level, cam: Math.round(world.cam), set: state.setIndex };
});

const res = {};
res.title = await g();
await page.screenshot({ path: new URL("01-title.png", OUT).pathname });

await page.keyboard.press("Enter");            // title -> select
await page.waitForTimeout(350);
res.select = await g();
await page.screenshot({ path: new URL("02-select.png", OUT).pathname });

await page.keyboard.press("ArrowRight");       // switch hero
await page.waitForTimeout(200);
res.selectSwitched = (await g()).set;

await page.keyboard.press("Enter");            // select -> story cards
await page.waitForTimeout(300);
res.story = await g();
await advanceCards();                          // opening cards -> play
await page.waitForTimeout(700);
res.start = await g();
await page.screenshot({ path: new URL("03-play.png", OUT).pathname });

// walk right ~1.2 s
const x0 = (await g()).x;
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(1200);
await page.keyboard.up("ArrowRight");
res.afterWalk = await g();
res.walked = res.afterWalk.x - x0;

// jump from open ground (well clear of any platform underside)
await page.evaluate(() => {
  const g = window.__GAME;
  g.player.x = 150; g.player.y = 400; g.player.vx = 0; g.player.vy = 0;
});
await page.waitForTimeout(400);
res.beforeJump = await g();
await page.keyboard.down("Space");
res.jumpMinY = await page.evaluate(() => new Promise((resolve) => {
  const g = window.__GAME;
  let min = g.player.y;
  const t0 = performance.now();
  (function loop() {
    min = Math.min(min, g.player.y);
    if (performance.now() - t0 < 500) requestAnimationFrame(loop); else resolve(min);
  })();
}));
await page.keyboard.up("Space");
await page.waitForTimeout(600);
res.afterJump = await g();

// attack
await page.keyboard.press("KeyJ");
await page.waitForTimeout(90);
res.attack = await page.evaluate(() => window.__GAME.player.attack);
await page.screenshot({ path: new URL("04-action.png", OUT).pathname });

// enemy interaction: put the player on top of the first enemy and stomp it
res.enemiesBefore = (await g()).enemies;
await page.evaluate(() => {
  const { player, world } = window.__GAME;
  const e = world.enemies.find((e) => e.alive);
  player.x = e.x - 4; player.y = e.y - 120; player.vy = 300; player.invuln = 0;
});
await page.waitForTimeout(700);
res.enemiesAfterStomp = (await g()).enemies;

// coin pickup
const coinsBefore = (await g()).coins;
await page.evaluate(() => {
  const { player, world } = window.__GAME;
  const c = world.coins.find((c) => !c.got);
  player.x = c.x - 10; player.y = c.y - 20; player.vx = 0; player.vy = 0;
});
await page.waitForTimeout(300);
res.coinGain = (await g()).coins - coinsBefore;

// goal: teleport next to the cushion
await page.evaluate(() => {
  const { player, world } = window.__GAME;
  player.x = world.goal.x - 30; player.y = world.goal.y - 80; player.vx = 0; player.vy = 0;
});
await page.waitForTimeout(500);
res.afterGoal = await g();
await page.screenshot({ path: new URL("05-clear.png", OUT).pathname });

// next level
await page.keyboard.press("Enter");
await page.waitForTimeout(700);
res.level2 = await g();
await page.screenshot({ path: new URL("06-level2.png", OUT).pathname });

// fall in a pit -> life lost / respawn
await page.evaluate(() => { const { player } = window.__GAME; player.y = 900; player.vy = 400; });
await page.waitForTimeout(600);
res.afterFall = await g();

res.errors = errors;

// checks
const check = {
  noErrors: errors.length === 0,
  titleLoaded: res.title.mode === "title",
  selectWorks: res.select.mode === "select",
  heroSwitch: res.selectSwitched === 1,
  openingPlayed: res.story.mode === "card",
  playStarted: res.start.mode === "play",
  movedRight: res.walked > 100,
  jumped: res.beforeJump.y - res.jumpMinY > 40,
  landed: res.afterJump.onGround === true,
  attackFired: res.attack > 0,
  stompKilled: res.enemiesAfterStomp === res.enemiesBefore - 1,
  coinCollected: res.coinGain >= 1,
  levelCleared: res.afterGoal.mode === "clear",
  level2Started: res.level2.mode === "play" && res.level2.level === 1,
  pitRespawn: res.afterFall.lives === 2,
};

console.log(JSON.stringify({ check, res }, null, 1));
await browser.close();
process.exit(Object.values(check).every(Boolean) ? 0 : 1);
