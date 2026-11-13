/* Phase 1.1 regressions: Shift guard, blur cancel, failed-release fizzle. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

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
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
for (let i = 0; i < 12; i++) {                 // opening story cards
  if ((await page.evaluate(() => window.__GAME.state.mode)) !== "card") break;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(140);
}
await page.waitForTimeout(300);

const read = () => page.evaluate(() => {
  const { state, player, world } = window.__GAME;
  return { mode: state.mode, charge: state.charge, charging: !!player.charging,
           power: player.power, x: player.x, particles: world.particles.length,
           selection: String(window.getSelection() || "") };
});
const out = {};

/* 1. Shift + arrows must charge/move but never select text. */
const before = await read();
await page.keyboard.down("Shift");
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(350);
const during = await read();
await page.keyboard.up("ArrowRight");
await page.keyboard.up("Shift");
out.shiftArrows = {
  charged: during.charge > 0,
  charging: during.charging,
  moved: during.x > before.x,
  selection: during.selection,
  pass: during.charge > 0 && during.x > before.x && during.selection === "",
};

/* 2. Releasing before full is a fizzle: keep the meter, no cast, show particles. */
await page.evaluate(() => { const g = window.__GAME; g.state.charge = 50; g.player.charging = false; g.player.vx = 0; });
await page.waitForTimeout(400);
await page.keyboard.down("Shift");
await page.waitForTimeout(160);
await page.keyboard.up("Shift");
await page.waitForTimeout(80);
const fizzle = await read();
out.fizzle = {
  charge: Math.round(fizzle.charge), charging: fizzle.charging, power: fizzle.power,
  particles: fizzle.particles,
  pass: !fizzle.charging && fizzle.charge >= 50 && fizzle.power === 0 && fizzle.particles > 0,
};

/* 3. Losing focus cancels the hold without casting. */
await page.evaluate(() => { window.__GAME.state.charge = 0; window.__GAME.player.vx = 0; });
await page.keyboard.down("Shift");
await page.waitForTimeout(400);
await page.evaluate(() => window.dispatchEvent(new Event("blur")));
await page.waitForTimeout(80);
const blurred = await read();
await page.waitForTimeout(250);
const settled = await read();
await page.keyboard.up("Shift");
out.blur = {
  canceled: !blurred.charging,
  chargeFrozen: Math.abs(settled.charge - blurred.charge) < 1,
  noCast: settled.mode === "play" && settled.power === 0,
  pass: !blurred.charging && Math.abs(settled.charge - blurred.charge) < 1
        && settled.mode === "play" && settled.power === 0,
};

/* 4. Releasing at full still casts. */
await page.evaluate(() => { window.__GAME.state.charge = 0; window.__GAME.player.vx = 0; });
await page.keyboard.down("Shift");
await page.waitForFunction(() => window.__GAME.state.charge >= window.__GAME.state.chargeMax, null, { timeout: 3000 });
await page.keyboard.up("Shift");
await page.waitForTimeout(60);
const cast = await read();
out.cast = { charge: cast.charge, power: cast.power, pass: cast.charge === 0 && cast.power > 0 };

out.errors = errors;
out.pass = out.shiftArrows.pass && out.fizzle.pass && out.blur.pass && out.cast.pass && errors.length === 0;
console.log(JSON.stringify(out, null, 1));
await browser.close();
process.exit(out.pass ? 0 : 1);
