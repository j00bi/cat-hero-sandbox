#!/usr/bin/env node
// Export one pixelfx effect as a game-ready sheet: actor-free, full frame size.
//
//   node tools/export-fx.mjs lightning/charge-up /tmp/chargeup
//
// Writes <out>.png (a horizontal strip, native px) and <out>.json (frame count, fps, pivot).
// A follow-up step trims the dead margin and installs into assets/fx/ — see SANDBOX.md.
import { writeFileSync } from "node:fs";
import { loadEffect, renderFrames, spriteSheet } from "/home/husni/pixelfx/tools/lib/fxlib.mjs";

const [id, out] = process.argv.slice(2);
if (!id || !out) { console.error("usage: export-fx.mjs <category/name> <out-basename>"); process.exit(2); }

const fx = await loadEffect(id);
const r = renderFrames(fx, { bg: "none", actor: false });
const s = spriteSheet(fx, r, id.split("/")[1]);
writeFileSync(`${out}.png`, s.png);
writeFileSync(`${out}.json`, JSON.stringify({
  id, fps: r.fps, frames: r.n, frameSize: [r.w, r.h], pivot: fx.meta.origin,
  loop: fx.meta.loop, duration: fx.meta.duration,
}, null, 1));
console.log(`${id}: ${r.n} frames @ ${r.fps}fps, ${r.w}x${r.h} -> ${out}.png`);
