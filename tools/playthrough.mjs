/* End-to-end proof that each level can actually be finished by a player:
   an autopilot holds right, jumps at walls and gaps, swipes at robots. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto((process.env.BASE || "http://127.0.0.1:8123") + "/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME);
await page.waitForTimeout(300);

const results = [];
const levels = await page.evaluate(() => window.__GAME.LEVELS.map((L, i) => ({ i, boss: !!L.boss, sandbox: !!L.sandbox })));
const platformLevels = levels.filter((L) => !L.boss && !L.sandbox);
for (const { i: lv } of platformLevels) {
  const r = await page.evaluate((level) => new Promise((resolve) => {
    const G = window.__GAME;
    G.state.lives = 3;
    G.loadLevel(level);
    const p = G.player, W = G.world;
    G.keys.right = true; G.keys.left = false;
    let best = p.x, t0 = performance.now(), stuck = 0, lastX = p.x;

    const solidAt = (x, y) => W.level.solids.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);

    function tick() {
      const now = performance.now();
      const aheadX = p.x + p.w + 26;
      const gap = !solidAt(aheadX, p.y + p.h + 12);
      const wall = solidAt(p.x + p.w + 7, p.y + p.h - 14);
      const enemy = W.enemies.find((e) => e.alive && e.x - (p.x + p.w) > 10 && e.x - (p.x + p.w) < 120);

      if ((gap || wall) && p.onGround) { G.queued.jump = true; G.keys.jump = true; setTimeout(() => { G.keys.jump = false; }, 240); }
      // jump again if truly stuck against something
      if (Math.abs(p.x - lastX) < 0.4) stuck++; else stuck = 0;
      lastX = p.x;
      if (stuck > 25 && p.onGround) { G.queued.jump = true; G.keys.jump = true; setTimeout(() => { G.keys.jump = false; }, 240); }
      if (enemy) G.queued.bat = true;

      best = Math.max(best, p.x);
      if (G.state.mode === "clear" || now - t0 > 45000 || G.state.lives <= 0) {
        G.keys.right = false;
        resolve({ mode: G.state.mode, x: Math.round(p.x), best: Math.round(best),
                  ms: Math.round(now - t0), lives: G.state.lives,
                  goal: W.goal.x, width: W.level.width });
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }), lv);
  results.push({ level: lv, ...r });
  if (r.mode !== "clear") await page.evaluate(() => { window.__GAME.state.mode = "title"; });
}

console.log(JSON.stringify(results, null, 1));
console.log("errors:", errors);
const ok = results.every((r) => r.mode === "clear");
console.log(ok ? "PLAYTHROUGH: all levels cleared" : "PLAYTHROUGH: FAILED");
await browser.close();
process.exit(ok && errors.length === 0 ? 0 : 1);
