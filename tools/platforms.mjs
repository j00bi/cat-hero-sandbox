/* Moving-platform proof: planks travel, the cat rides them, and the ride
   carries it without any input. Fails on any console/page error. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const errors = [];
const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto((process.env.BASE || "http://127.0.0.1:8123") + "/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME);
await page.waitForTimeout(300);

const out = await page.evaluate(async () => {
  const G = window.__GAME;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const report = { levels: G.LEVELS.length, checks: {} };

  // 1. every level that declares platforms actually builds them
  report.platformLevels = G.LEVELS.map((L, i) => ({ i, name: L.name, n: (L.platforms || []).length }))
    .filter((x) => x.n > 0);
  report.checks.built = report.platformLevels.length === 1 && report.platformLevels[0].n === 3;

  // 2. horizontal plank travels
  G.loadLevel(report.platformLevels[0].i);
  const hplank = G.world.plats.find((q) => q.axis === "x");
  const x0 = hplank.x;
  await sleep(650);
  report.checks.travels = Math.abs(hplank.x - x0) > 20;

  // 3. the cat stands on it and is carried with no input
  const p = G.player;
  p.x = hplank.x + 50; p.y = hplank.y - p.h - 1; p.vx = 0; p.vy = 0;
  await sleep(250);
  report.ride = { onPlank: p.ride === hplank, onGround: p.onGround };
  const px0 = p.x, plx0 = hplank.x;
  await sleep(600);
  report.carry = {
    playerMoved: Math.round(p.x - px0),
    plankMoved: Math.round(hplank.x - plx0),
    stillOn: p.ride === hplank,
  };
  report.checks.rides = report.ride.onPlank && report.carry.stillOn;

  // 4. vertical lift carries the cat upward
  const vLevel = report.platformLevels.find((lv) => {
    G.loadLevel(lv.i);
    return G.world.plats.some((q) => q.axis === "y");
  });
  const lift = G.world.plats.find((q) => q.axis === "y");
  p.x = lift.x + 20; p.y = lift.y - p.h - 1; p.vx = 0; p.vy = 0;
  await sleep(250);
  const y0 = p.y;
  let dy = 0;
  for (let k = 0; k < 60; k++) { await sleep(16); dy = Math.max(dy, Math.abs(p.y - y0)); }
  report.lift = { level: vLevel ? vLevel.name : null, dy: Math.round(dy), ride: p.ride === lift };
  report.checks.liftCarries = dy > 10 && p.ride === lift;

  // 5. every level still loads clean
  report.loads = [];
  for (let i = 0; i < G.LEVELS.length; i++) {
    G.loadLevel(i);
    report.loads.push({ i, ok: G.world.level === G.LEVELS[i] && (G.world.level.sandbox || G.world.level.ray || G.world.coins.length > 0) });
  }
  report.checks.allLoad = report.loads.every((l) => l.ok);
  return report;
});

console.log(JSON.stringify(out, null, 1));
console.log("errors:", errors);
const ok = Object.values(out.checks).every(Boolean) && errors.length === 0;
console.log(ok ? "PLATFORMS: ok" : "PLATFORMS: FAILED");
await browser.close();
process.exit(ok ? 0 : 1);
