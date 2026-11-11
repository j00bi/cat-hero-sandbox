import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
await page.goto("http://127.0.0.1:8123/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });

const report = await page.evaluate(() => {
  const { LEVELS } = window.__GAME;
  const MAXDX = 190, MAXUP = 112;

  function gap(a, b) {
    if (a.x + a.w < b.x) return b.x - (a.x + a.w);
    if (b.x + b.w < a.x) return a.x - (b.x + b.w);
    return 0;
  }

  return LEVELS.filter((L) => !L.sandbox).map((L, li) => {
    const nodes = L.solids.filter((s) => s.w >= 40).map((s, i) => ({ ...s, i, key: i }));
    // A moving platform counts as every point on its travel path: you can board
    // it anywhere along the sweep and it carries you to the rest.
    const plats = L.platforms || [];
    for (const q of plats) {
      const i = nodes.length;
      // Vertical lifts are judged from their lowest point: you board them at the
      // bottom and ride up, so treating the whole sweep as one high node would
      // wrongly report them unreachable from the ground.
      nodes.push(q.axis === "y"
        ? { x: q.x, w: q.w, y: q.y + q.range, h: q.h, i, key: i }
        : { x: q.x - q.range, w: q.w + q.range * 2, y: q.y, h: q.h, i, key: i });
    }
    const startIdx = nodes.reduce((best, n) =>
      Math.abs(n.x - L.spawn.x) < Math.abs(nodes[best].x - L.spawn.x) ? n.i : best, 0);

    const seen = new Set([startIdx]);
    const q = [startIdx];
    while (q.length) {
      const cur = nodes[q.shift()];
      for (const n of nodes) {
        if (seen.has(n.i)) continue;
        const g = gap(cur, n);
        const dy = cur.y - n.y;                 // >0 means n is higher
        if (dy > MAXUP) continue;
        if (g > MAXDX) continue;
        if (g > 0 && dy > MAXUP * 0.55 && g > 150) continue; // long + high = not in a single arc
        seen.add(n.i); q.push(n.i);
      }
    }
    const goalNode = nodes.find((n) => Math.abs(n.x + n.w - L.goal.x) < 200 || (L.goal.x > n.x - 100 && L.goal.x < n.x + n.w + 160));
    return {
      level: li, name: L.name,
      nodes: nodes.length,
      reachable: seen.size,
      goalReachable: goalNode ? seen.has(goalNode.i) : false,
      unreachable: nodes.filter((n) => !seen.has(n.i)).map((n) => `${n.x},${n.y}`),
    };
  });
});

console.log(JSON.stringify(report, null, 1));
await browser.close();
process.exit(report.every((r) => r.goalReachable) ? 0 : 1);
