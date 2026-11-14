/* STRIP INGESTION — proves the cutter can be trusted on a real strip.
   1. rebuilds the atlas from the raw walk strip into a temp dir (base copied,
      assets/ untouched), then decodes the result in Chromium: frame count,
      one shared foot row, Apollo-only palette, no empty cell.
   2. proves the repo's already-cut preview sheets (paper background) cut too.
   3. proves the new checks reject a wrong frame count, a ghost frame and a
      speed-line frame, and accept a clean synthetic strip.
   4. asserts assets/cat-atlas.* and ART_V did not move. */
import { chromium } from "/home/husni/.hermes/node/lib/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = process.env.BASE || "http://127.0.0.1:8124";
const PY = process.env.PYTHON || "python3";
const CUT = path.join(ROOT, "tools", "strip_atlas.py");
const OUT = new URL("../shots/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cat-strip-"));
const errors = [];
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const run = (args) => {
  try {
    const stdout = execFileSync(PY, [CUT, ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    return { code: e.status, stdout: String(e.stdout || ""), stderr: String(e.stderr || "") };
  }
};
const jsonl = (stdout) => stdout.split("\n").filter((l) => l.trim().startsWith("{"))
  .map((l) => JSON.parse(l));

const browser = await chromium.launch({ executablePath: "/home/husni/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(BASE + "/?dev=1", { waitUntil: "networkidle" });

const __build = await page.evaluate(() => window.__BUILD);
if (__build !== "cat-hero-sandbox") {
  console.error("[target] " + page.url() + " is not cat-hero-sandbox (build=" + __build + ")");
  console.error("[target] a different project is serving this port - start a server in this repo and set BASE");
  process.exit(2);
}
await page.waitForFunction(() => window.__GAME, null, { timeout: 10000 });

const out = {};
out.fixtures = {
  walkPng: fs.existsSync(path.join(ROOT, "out/gemini/walk-strip.png")),
  runPng: fs.existsSync(path.join(ROOT, "out/gemini/run-strip.png")),
  walkJpg: fs.existsSync(path.join(ROOT, "out/gemini/walk-strip.jpg")),
};

/* ------------------------------------------------------- assets fingerprint */
const assetsBefore = {
  png: sha(path.join(ROOT, "assets/cat-atlas.png")),
  json: sha(path.join(ROOT, "assets/cat-atlas.json")),
  artV: (fs.readFileSync(path.join(ROOT, "game.js"), "utf8").match(/const ART_V = "([^"]+)"/) || [])[1],
};

/* ------------------------------------------- 1. rebuild the atlas from a strip */
const baseDir = path.join(tmp, "base");
fs.mkdirSync(baseDir, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, "out/autosprite/base-assets")))
  fs.copyFileSync(path.join(ROOT, "out/autosprite/base-assets", f), path.join(baseDir, f));
const baseHeight = (() => {
  const meta = JSON.parse(fs.readFileSync(path.join(baseDir, "cat-atlas.json"), "utf8"));
  const rects = Object.values(meta.black).flat();
  return Math.max(...rects.map((r) => r.y + r.h));
})();

const walkOut = path.join(tmp, "walk");
const walk = run(["--strip", "walk=out/gemini/walk-strip.jpg", "--expect", "8",
                  "--base", baseDir, "--out", walkOut]);
out.rebuild = { code: walk.code, stderr: walk.stderr.trim().split("\n").slice(-2) };
out.rebuild.frames = jsonl(walk.stdout);

const atlasPath = path.join(walkOut, "cat-atlas.png");
const metaPath = path.join(walkOut, "cat-atlas.json");
out.atlasWritten = fs.existsSync(atlasPath) && fs.existsSync(metaPath);
const meta = out.atlasWritten ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
const rects = meta ? [...meta.black.walk, ...meta.grey.walk] : [];
out.meta = {
  black: meta ? (meta.black.walk || []).length : 0,
  grey: meta ? (meta.grey.walk || []).length : 0,
  cells: rects.length,
  all96: rects.every((r) => r.w === 96 && r.h === 96),
  foot7: rects.every((r) => r.foot === 7),
  appendedBelowBase: rects.every((r) => r.y >= baseHeight),
};

/* decode the built atlas in Chromium: feet, empties, palette */
const palette = JSON.parse(fs.readFileSync(path.join(ROOT, "spec/character.json"), "utf8"))
  .palette.colors.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
out.decode = await page.evaluate(async ({ b64, rects, palette }) => {
  const img = new Image();
  img.src = "data:image/png;base64," + b64;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const apollo = new Set(palette.map((p) => p.join(",")));
  const feet = [], empty = [], bad = new Set();
  for (const r of rects) {
    const d = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    let foot = -1, any = false;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const i = (y * r.w + x) * 4;
        if (d[i + 3] >= 128) {
          any = true;
          foot = y;
          const key = d[i] + "," + d[i + 1] + "," + d[i + 2];
          if (!apollo.has(key) && bad.size < 10) bad.add(key);
        }
      }
    }
    feet.push(foot);
    empty.push(!any);
  }
  return { width: img.width, height: img.height, feet, empty, bad: [...bad] };
}, { b64: fs.readFileSync(atlasPath).toString("base64"), rects, palette });

out.contact = { walk: path.join(walkOut, "walk-contact.png") };
if (fs.existsSync(out.contact.walk)) {
  const b = fs.readFileSync(out.contact.walk);
  out.contact.w = b.readUInt32BE(16);
  out.contact.h = b.readUInt32BE(20);
}
out.contactDecodes = await page.evaluate(async (p) => new Promise((res) => {
  const i = new Image(); i.onload = () => res({ ok: true, w: i.naturalWidth, h: i.naturalHeight });
  i.onerror = () => res({ ok: false }); i.src = "data:image/png;base64," + p;
}), out.contact.walk ? fs.readFileSync(out.contact.walk).toString("base64") : "");
// expected: 8 cells * 96 + 9 gutters * 8 = 840 wide at 1x, head 22 + cell 96 + label 16 + pad 8 = 142 tall
out.contactExpected = out.contact.w === 1680 && out.contact.h === 284;

/* --------------------------------- 2. the repo's preview sheets cut (dry run) */
const dryOut = path.join(tmp, "dry");
const dryWalk = run(["--strip", "walk=out/gemini/walk-strip.png", "--expect", "8",
                     "--dry-run", "--base", "", "--out", dryOut]);
const dryRun = run(["--strip", "run=out/gemini/run-strip.png", "--expect", "6",
                    "--dry-run", "--base", "", "--out", dryOut]);
out.dry = {
  walkCode: dryWalk.code,
  runCode: dryRun.code,
  walkFrames: jsonl(dryWalk.stdout).length,
  runFrames: jsonl(dryRun.stdout).length,
  walkContact: fs.existsSync(path.join(dryOut, "walk-contact.png")),
  runContact: fs.existsSync(path.join(dryOut, "run-contact.png")),
  wroteAtlas: fs.existsSync(path.join(dryOut, "cat-atlas.png")) || fs.existsSync(path.join(dryOut, "cat-atlas.json")),
  runFeet: [...new Set(jsonl(dryRun.stdout).map((r) => r.baseline))],
  walkFeet: [...new Set(jsonl(dryWalk.stdout).map((r) => r.baseline))],
  runBackground: jsonl(dryRun.stdout)[0] && jsonl(dryRun.stdout)[0].background,
};

/* ------------------------------------------------- 3. what the checks reject */
// synthetic strips: clean, ghost, speed line
const helper = `
import sys
from PIL import Image
from pathlib import Path
d = Path(sys.argv[1])
def make(name, cw, ch, frames):
    im = Image.new("RGB", (cw * len(frames), ch), (255, 0, 255))
    for i, ops in enumerate(frames):
        for (x, y, w, h) in ops:
            for yy in range(y, y + h):
                for xx in range(x, x + w):
                    im.putpixel((i * cw + xx, yy), (30, 30, 30))
    im.save(d / name)
solid = [[(20, 20, 80, 80)] for _ in range(8)]
# a wide, mostly-erased frame: still installs a few columns, far fewer pixels
ghost = [[(20, 20, 80, 80)] for _ in range(7)] + [[(20, 20, 70, 10), (50, 20, 10, 70)]]
# a sparse streaked frame: two thick bars, bbox mostly empty (low density)
streak = [[(20, 20, 80, 80)] for _ in range(7)] + [[(20, 20, 200, 12), (20, 68, 200, 12)]]
make("solid.png", 120, 120, solid)
make("ghost.png", 120, 120, ghost)
make("streak.png", 260, 120, streak)
print("ok")
`;
const helperPath = path.join(tmp, "make_fixtures.py");
fs.writeFileSync(helperPath, helper);
execFileSync(PY, [helperPath, tmp], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const solid = run(["--strip", `solid=${path.join(tmp, "solid.png")}`, "--expect", "8",
                   "--base", "", "--out", path.join(tmp, "solid")]);
const count = run(["--strip", "walk=out/gemini/walk-strip.jpg", "--expect", "7",
                   "--base", "", "--out", path.join(tmp, "count")]);
const ghost = run(["--strip", `ghost=${path.join(tmp, "ghost.png")}`, "--expect", "8",
                   "--base", "", "--out", path.join(tmp, "ghost")]);
const streak = run(["--strip", `streak=${path.join(tmp, "streak.png")}`, "--expect", "8",
                    "--base", "", "--out", path.join(tmp, "streak")]);

out.rejects = {
  cleanAccepted: solid.code === 0,
  wrongCount: count.code === 2 && /frame count/.test(count.stderr),
  ghost: ghost.code === 2 && /coverage/.test(ghost.stderr),
  speedLine: streak.code === 2 && /density/.test(streak.stderr),
  noAtlasOnReject: !fs.existsSync(path.join(tmp, "count", "cat-atlas.png")),
  countMessage: (count.stderr.match(/\[strip\].*/) || [""])[0],
  ghostMessage: (ghost.stderr.match(/\[strip\].*/) || [""])[0],
  streakMessage: (streak.stderr.match(/\[strip\].*/) || [""])[0],
};

/* --------------------------------------------- 4. assets untouched, ART_V quiet */
const assetsAfter = {
  png: sha(path.join(ROOT, "assets/cat-atlas.png")),
  json: sha(path.join(ROOT, "assets/cat-atlas.json")),
  artV: (fs.readFileSync(path.join(ROOT, "game.js"), "utf8").match(/const ART_V = "([^"]+)"/) || [])[1],
};

const feet = out.decode.feet;
out.checks = {
  fixturesPresent: out.fixtures.walkPng && out.fixtures.runPng && out.fixtures.walkJpg,
  rebuildsAtlas: out.rebuild.code === 0 && out.atlasWritten && out.meta.black === 8 && out.meta.grey === 8,
  frameCount: out.rebuild.frames.length === 8 && out.meta.black === 8,
  frameJsonComplete: out.rebuild.frames.every((r) => r.bbox && typeof r.height === "number"
    && typeof r.baseline === "number" && typeof r.scaled === "boolean"),
  sharedFootRow: feet.length === 16 && new Set(feet).size === 1 && feet[0] === 87
    && out.rebuild.frames.every((r) => r.baseline === 87),
  paletteApolloOnly: out.decode.bad.length === 0,
  noEmptyCell: out.decode.empty.every((e) => e === false),
  cellsAre96: out.meta.all96 && out.meta.foot7 && out.meta.appendedBelowBase,
  dropsInto96Grid: out.decode.width === 768 && out.decode.height === 1056,
  contactSheet: out.contactExpected && out.contactDecodes.ok,
  paperSheetsCut: out.dry.walkCode === 0 && out.dry.runCode === 0
    && out.dry.walkFrames === 8 && out.dry.runFrames === 6 && out.dry.runBackground === "paper",
  dryRunWritesContactOnly: out.dry.walkContact && out.dry.runContact && !out.dry.wroteAtlas,
  dryRunSharedFoot: out.dry.runFeet.length === 1 && out.dry.walkFeet.length === 1,
  rejectsWrongCount: out.rejects.wrongCount && out.rejects.noAtlasOnReject,
  rejectsGhost: out.rejects.ghost,
  rejectsSpeedLine: out.rejects.speedLine,
  cleanStripAccepted: out.rejects.cleanAccepted,
  assetsUntouched: assetsBefore.png === assetsAfter.png && assetsBefore.json === assetsAfter.json,
  artVUnchanged: assetsBefore.artV === assetsAfter.artV,
  noErrors: errors.length === 0,
};
out.pass = Object.values(out.checks).every(Boolean);
out.errors = errors;
out.baseHeight = baseHeight;
out.tmp = tmp;
console.log(JSON.stringify(out, null, 1));
await browser.close();
if (out.pass) fs.rmSync(tmp, { recursive: true, force: true });
process.exit(out.pass ? 0 : 1);
