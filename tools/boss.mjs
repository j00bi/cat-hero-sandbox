/* The Dust King: bait it into a wall, stomp the stun, three times, then the
   cushion comes back. Also proves stomping an un-stunned boss does nothing. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const errors = [];
const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto("http://127.0.0.1:8123/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME);
await page.waitForTimeout(300);

const out = await page.evaluate(async () => {
  const G = window.__GAME;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bossLevel = G.LEVELS.findIndex((L) => L.boss);
  const report = { bossLevel, checks: {} };

  G.loadLevel(bossLevel);
  const b = G.world.boss;
  const p = G.player;
  report.setup = {
    name: G.LEVELS[bossLevel].name,
    hp: b.hp,
    cushionHidden: G.world.goal === null,
    walled: G.world.level.solids.filter((s) => s.h > 200).length === 2,
  };
  report.checks.setup = report.setup.hp === 3 && report.setup.cushionHidden && report.setup.walled;

  // stomping a boss that is not stunned must do nothing
  p.x = b.x + 30; p.y = b.y - 70; p.vx = 0; p.vy = 420;
  await sleep(400);
  report.checks.shielded = G.world.boss.hp === 3;

  // bait: stand far away, let it charge, wait for the wall slam
  const waitStun = async (ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (G.world.boss.state === "stun") return true;
      await sleep(40);
    }
    return false;
  };

  const hits = [];
  // stand on the left ledge: the boss charges underneath into the wall
  for (let i = 0; i < 3; i++) {
    p.x = 195; p.y = 312; p.vx = 0; p.vy = 0;
    const stunned = await waitStun(14000);
    if (!stunned) break;
    const bb = G.world.boss;
    const before = bb.hp;
    // drop in from above the ledges (y=300) so we never land on one instead
    for (let attempt = 0; attempt < 3 && G.world.boss.hp === before; attempt++) {
      p.x = Math.max(70, Math.min(1090, bb.x + 34));
      p.y = 296; p.vx = 0; p.vy = 520;
      await sleep(420);
    }
    hits.push({ after: i + 1, hp: G.world.boss.hp, state: G.world.boss.state });
  }
  report.hits = hits;
  report.checks.threeHits = hits.length === 3 && hits[2].hp === 0;

  await sleep(1200);
  report.afterDeath = { dead: G.world.boss.dead, cushion: G.world.goal ? G.world.goal.x : null };
  report.checks.cushionReturns = G.world.boss.dead === true && G.world.goal !== null;

  // walking into the freed cushion ends the run
  if (G.world.goal) {
    p.x = G.world.goal.x; p.y = G.world.goal.y - 60; p.vx = 0; p.vy = 0;
    await sleep(300);
    report.checks.reachesHome = G.state.mode === "clear";
  } else {
    report.checks.reachesHome = false;
  }

  // dying in the arena must reset the boss to full health
  G.loadLevel(bossLevel);
  G.state.lives = 3;
  const b2 = G.world.boss;
  G.player.x = b2.x + 30; G.player.y = b2.y - 70; G.player.vy = 420;
  await sleep(300);
  G.world.boss.hp = 1;
  G.player.x = G.world.boss.x; G.player.y = G.world.boss.y + 20; G.player.vy = 0;
  await sleep(400);
  report.retry = { hp: G.world.boss.hp, state: G.world.boss.state, lives: G.state.lives };
  report.checks.retryResets = G.world.boss.hp === 3 && G.state.lives === 2;
  return report;
});

console.log(JSON.stringify(out, null, 1));
console.log("errors:", errors);
const ok = Object.values(out.checks).every(Boolean) && errors.length === 0;
console.log(ok ? "BOSS: ok" : "BOSS: FAILED");
await browser.close();
process.exit(ok ? 0 : 1);
