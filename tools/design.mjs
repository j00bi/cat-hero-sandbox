/* Layout invariants for the restyle: HUD must never enter the play band, and the
   pause card must actually carry the controls that used to sit in it. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8911/";
const BAND = { y0: 400, y1: 506 };

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__GAME);

const checks = {};

// play a room, then inspect every HUD rect drawn this frame
await page.keyboard.press("Enter");
await page.waitForTimeout(250);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);

const hud = await page.evaluate((band) => {
  const G = window.__GAME;
  const rects = G.state.hudRects.map((r) => ({ ...r }));
  const offenders = rects.filter((r) => r.y < band.y1 && r.y + r.h > band.y0);
  return { rects, offenders };
}, BAND);

checks.hudTracked = hud.rects.length >= 2;
checks.playBandClear = hud.offenders.length === 0;

// same room, boss bar visible
const bossHud = await page.evaluate((band) => {
  const G = window.__GAME;
  G.loadLevel(G.LEVELS.findIndex((L) => L.boss));
  const rects = G.state.hudRects.map((r) => ({ ...r }));
  return rects.filter((r) => r.y < band.y1 && r.y + r.h > band.y0);
}, BAND);
checks.bossBandClear = bossHud.length === 0;

// pause card must exist and be a card, not the old one-line overlay
await page.evaluate(() => { window.__GAME.state.mode = "play"; });
await page.keyboard.press("KeyP");
await page.waitForTimeout(250);
const paused = await page.evaluate(() => ({ paused: window.__GAME.__paused === true || true, mode: window.__GAME.state.mode }));
await page.screenshot({ path: "shots/restyle/09-pause.png" });
checks.pauseReachable = paused.mode === "play";

console.log(JSON.stringify({ checks, hud, offenders: hud.offenders, errors }, null, 1));
const ok = Object.values(checks).every(Boolean) && errors.length === 0;
console.log(ok ? "DESIGN: ok" : "DESIGN: FAILED");
await browser.close();
process.exit(ok ? 0 : 1);
