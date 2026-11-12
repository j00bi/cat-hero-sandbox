/* Phone check: no keyboard at all — tap must start the game, touch buttons must move it. */
import { chromium, devices } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto((process.env.BASE || "http://127.0.0.1:8123") + "/", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME);
await page.waitForTimeout(400);

const mode = () => page.evaluate(() => window.__GAME.state.mode);
const box = await page.locator("#game").boundingBox();
const tap = async (fx = 0.5, fy = 0.5) => {
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(350);
};

const out = { title: await mode() };
await page.screenshot({ path: "shots/10-mobile-title.png" });
await tap();                       // title -> select
out.afterTap1 = await mode();
await tap(0.8);                    // tap the grey cat card (switch hero)
out.setIndex = await page.evaluate(() => window.__GAME.state.setIndex);
await tap(0.8);                    // tap again -> start with grey cat
out.afterTap2 = await mode();
await page.screenshot({ path: "shots/11-mobile-play.png" });

// jump button
const before = await page.evaluate(() => window.__GAME.player.y);
await page.locator('[data-k="jump"]').dispatchEvent("pointerdown");
await page.waitForTimeout(180);
const apex = await page.evaluate(() => window.__GAME.player.y);
await page.locator('[data-k="jump"]').dispatchEvent("pointerup");
out.jumpedByTouch = before - apex > 20;

// move button
const x0 = await page.evaluate(() => window.__GAME.player.x);
await page.locator('[data-k="right"]').dispatchEvent("pointerdown");
await page.waitForTimeout(600);
await page.locator('[data-k="right"]').dispatchEvent("pointerup");
const x1 = await page.evaluate(() => window.__GAME.player.x);
out.movedByTouch = x1 - x0 > 40;

out.errors = errors;
out.pass = out.afterTap1 === "select" && out.afterTap2 === "play" && out.setIndex === 1
  && out.jumpedByTouch && out.movedByTouch && errors.length === 0;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
