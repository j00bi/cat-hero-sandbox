/* CAT HERO — a small pixel platformer built around the sprite sheet.
   No dependencies. Canvas 2D at a fixed 960x540 logical resolution. */
(() => {
"use strict";

const W = 960, H = 540, TILE = 32;
const GRAV = 2200, JUMP_V = -690, MOVE = 272, ACCEL = 2600, FRIC = 2400, MAXFALL = 980;
const COYOTE = 0.09, JUMP_BUF = 0.12;

/* meadow palette taken from the reference mockup */
const C = {
  skyTop: "#5BA8E5", skyMid: "#8CC8F0", skyLow: "#C6E6FA",
  mountFar: "#2E5A8A", mountMid: "#4A7A9E", mountHi: "#7FA8C8",
  forest: "#2E7D32", forestDark: "#1F5A24", forestHi: "#4CAF50",
  grass: "#4CAF50", grassHi: "#81C784", grassDark: "#2E7D32",
  dirt: "#5D4037", dirtDark: "#3E2723", dirtHi: "#795548",
  water: "#3B7EC4", waterDeep: "#2A5E96", waterHi: "#8CC8F0",
  stone: "#A1887F", stoneDark: "#7E675F", roof: "#D32F2F", roofDark: "#9E1F1F",
  ink: "#212121", paper: "#FFFFFF", gold: "#FFEB3B", red: "#E53935",
  panel: "rgba(16,24,20,0.78)",
};

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

/* ------------------------------------------------------------------ font */
const FONT = {
  A:["01110","10001","10001","11111","10001","10001","10001"],
  B:["11110","10001","10001","11110","10001","10001","11110"],
  C:["01110","10001","10000","10000","10000","10001","01110"],
  D:["11110","10001","10001","10001","10001","10001","11110"],
  E:["11111","10000","10000","11110","10000","10000","11111"],
  F:["11111","10000","10000","11110","10000","10000","10000"],
  G:["01110","10001","10000","10111","10001","10001","01111"],
  H:["10001","10001","10001","11111","10001","10001","10001"],
  I:["11111","00100","00100","00100","00100","00100","11111"],
  J:["00111","00010","00010","00010","00010","10010","01100"],
  K:["10001","10010","10100","11000","10100","10010","10001"],
  L:["10000","10000","10000","10000","10000","10000","11111"],
  M:["10001","11011","10101","10101","10001","10001","10001"],
  N:["10001","11001","10101","10011","10001","10001","10001"],
  O:["01110","10001","10001","10001","10001","10001","01110"],
  P:["11110","10001","10001","11110","10000","10000","10000"],
  Q:["01110","10001","10001","10001","10101","10010","01101"],
  R:["11110","10001","10001","11110","10100","10010","10001"],
  S:["01111","10000","10000","01110","00001","00001","11110"],
  T:["11111","00100","00100","00100","00100","00100","00100"],
  U:["10001","10001","10001","10001","10001","10001","01110"],
  V:["10001","10001","10001","10001","10001","01010","00100"],
  W:["10001","10001","10001","10101","10101","11011","10001"],
  X:["10001","10001","01010","00100","01010","10001","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"],
  Z:["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],
  "1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],
  "3":["11111","00010","00100","00010","00001","10001","01110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],
  "5":["11111","10000","11110","00001","00001","10001","01110"],
  "6":["00110","01000","10000","11110","10001","10001","01110"],
  "7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],
  "9":["01110","10001","10001","01111","00001","00010","01100"],
  " ":["00000","00000","00000","00000","00000","00000","00000"],
  ":":["00000","00100","00100","00000","00100","00100","00000"],
  "!":["00100","00100","00100","00100","00100","00000","00100"],
  ".":["00000","00000","00000","00000","00000","00110","00110"],
  "-":["00000","00000","00000","11111","00000","00000","00000"],
  "+":["00000","00100","00100","11111","00100","00100","00000"],
  "/":["00001","00010","00010","00100","01000","01000","10000"],
  "'":["00100","00100","00000","00000","00000","00000","00000"],
  "<":["00010","00100","01000","10000","01000","00100","00010"],
  ">":["01000","00100","00010","00001","00010","00100","01000"],
  "?":["01110","10001","00001","00010","00100","00000","00100"],
  "*":["00000","10101","01110","11111","01110","10101","00000"],
};

function textWidth(str, s) { return str.length * 6 * s - s; }

function text(str, x, y, s = 2, color = "#1b1410", align = "left") {
  str = String(str).toUpperCase();
  let cx = align === "center" ? x - textWidth(str, s) / 2
        : align === "right" ? x - textWidth(str, s) : x;
  ctx.fillStyle = color;
  for (const ch of str) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) if (row[c] === "1") {
        ctx.fillRect(Math.round(cx + c * s), Math.round(y + r * s), s, s);
      }
    }
    cx += 6 * s;
  }
}

/* ----------------------------------------------------------------- atlas */
let atlasImg = new Image();
let ATLAS = null;

const state = {
  mode: "title", t: 0, level: 0, lives: 3, coins: 0, totalCoins: 0, fish: 0,
  setIndex: 0, shake: 0, flash: 0, muted: false, best: 0,
};

const keys = Object.create(null);
const queued = { jump: false, bat: false };
let paused = false;

/* ----------------------------------------------------------------- audio */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  return AC;
}
function beep(freq, dur, type = "square", vol = 0.12, slideTo = null) {
  if (state.muted) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + dur + 0.02);
}
const sfx = {
  jump: () => beep(420, 0.14, "square", 0.10, 760),
  land: () => beep(180, 0.05, "triangle", 0.06),
  coin: () => { beep(880, 0.07, "square", 0.09); setTimeout(() => beep(1320, 0.09, "square", 0.08), 60); },
  bat: () => beep(300, 0.07, "sawtooth", 0.08, 140),
  hit: () => beep(220, 0.18, "sawtooth", 0.12, 90),
  kill: () => beep(520, 0.1, "square", 0.1, 180),
  win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, "square", 0.1), i * 110)); },
  charge: () => beep(90, 0.45, "sawtooth", 0.10, 300),
  clank: () => beep(140, 0.12, "square", 0.10, 60),
  bossHit: () => { beep(160, 0.14, "square", 0.13, 70); setTimeout(() => beep(90, 0.2, "triangle", 0.10), 70); },
  bossDie: () => { [300, 240, 180, 120, 70].forEach((f, i) => setTimeout(() => beep(f, 0.22, "sawtooth", 0.11, f * 0.5), i * 130)); },
};

/* ----------------------------------------------------------------- input */
const MAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump",
  KeyJ: "bat", KeyX: "bat",
};
addEventListener("keydown", (e) => {
  const k = MAP[e.code];
  if (k) {
    e.preventDefault();
    if (!keys[k]) {
      if (k === "jump") queued.jump = true;
      if (k === "bat") queued.bat = true;
    }
    keys[k] = true;
  }
  if (e.code === "Enter" || e.code === "Space") { if (!keys.confirm) { keys.confirm = true; queued.confirm = true; } }
  if (e.code === "KeyM") toggleMute();
  if (e.code === "KeyP" || e.code === "Escape") { if (state.mode === "play") paused = !paused; }
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
    if (state.mode === "select" && !e.repeat) {
      state.setIndex = 1 - state.setIndex;
      beep(660, 0.05, "square", 0.06);
    }
  }
});
addEventListener("keyup", (e) => {
  const k = MAP[e.code]; if (k) keys[k] = false;
  if (e.code === "Enter" || e.code === "Space") keys.confirm = false;
});

document.querySelectorAll("#touch button").forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); e.stopPropagation(); keys[k] = true; if (k === "jump") queued.jump = true; if (k === "bat") queued.bat = true; };
  const off = (e) => { e.preventDefault(); e.stopPropagation(); keys[k] = false; };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("pointerleave", off);
});

/* Tap/click anywhere on the canvas to advance menus — phones have no Enter key. */
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const a = ac();
  if (a && a.state === "suspended") a.resume();
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W;
  if (state.mode === "select") {
    const want = x < W / 2 ? 0 : 1;
    if (want !== state.setIndex) {
      state.setIndex = want;
      beep(660, 0.05, "square", 0.06);
      return;
    }
  }
  queued.confirm = true;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

/* ---------------------------------------------------------------- levels */
function rect(x, y, w, h) { return { x, y, w, h }; }
function arc(cx, cy, n, r = 52, step = 0.42) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.75 });
  }
  return out;
}
function line(x, y, n, dx = 40) {
  return Array.from({ length: n }, (_, i) => ({ x: x + i * dx, y }));
}

const LEVELS = [
  {
    world: "1-1", name: "MEADOW FIELDS",
    width: 2600,
    spawn: { x: 80, y: 380 },
    solids: [
      rect(0, 470, 900, 90), rect(980, 470, 700, 90), rect(1780, 470, 820, 90),
      rect(420, 380, 180, 26), rect(640, 300, 140, 26), rect(1100, 370, 190, 26),
      rect(1340, 290, 150, 26), rect(1560, 300, 140, 26), rect(1960, 372, 220, 26),
      rect(2200, 290, 160, 26),
    ],
    coins: [
      ...arc(300, 400, 5), ...arc(700, 404, 5),
      ...line(440, 336, 4), ...line(660, 256, 3), ...line(1120, 326, 4),
      ...line(1360, 246, 3), ...line(1580, 256, 3), ...line(1980, 328, 4),
      ...line(2220, 246, 4), ...arc(1000, 404, 5),
    ],
    enemies: [
      { x: 620, min: 520, max: 860 },
      { x: 1180, min: 1000, max: 1460 },
      { x: 2020, min: 1800, max: 2400 },
    ],
    goal: { x: 2470, y: 470 },
    decor: [
      { t: "sign", x: 132 }, { t: "tree", x: 250 }, { t: "bush", x: 360 },
      { t: "tree", x: 700 }, { t: "bush", x: 840 }, { t: "tree", x: 1150 },
      { t: "bush", x: 1420 }, { t: "tree", x: 1900 }, { t: "bush", x: 2100 },
      { t: "tree", x: 2330, s: 0.85 },
    ],
  },
  {
    world: "1-2", name: "THE OLD ORCHARD",
    width: 3100,
    spawn: { x: 70, y: 360 },
    solids: [
      rect(0, 470, 620, 90), rect(700, 470, 520, 90), rect(1300, 470, 380, 90),
      rect(1760, 470, 300, 90), rect(2140, 470, 960, 90),
      rect(300, 372, 150, 24), rect(560, 280, 140, 24), rect(760, 190, 160, 24),
      rect(1000, 300, 150, 24), rect(1220, 372, 130, 24), rect(1420, 286, 150, 24),
      rect(1620, 196, 150, 24), rect(1860, 320, 150, 24), rect(2100, 240, 170, 24),
      rect(2380, 350, 160, 24), rect(2620, 268, 150, 24),
    ],
    coins: [
      ...line(320, 328, 3), ...line(580, 236, 3), ...line(780, 146, 3),
      ...line(1020, 256, 3), ...line(1440, 242, 3), ...line(1640, 152, 3),
      ...arc(880, 400, 5), ...line(1880, 276, 3), ...line(2120, 196, 4),
      ...arc(1700, 420, 5), ...line(2640, 224, 3),
    ],
    enemies: [
      { x: 400, min: 250, max: 600 },
      { x: 900, min: 720, max: 1200 },
      { x: 1450, min: 1310, max: 1660 },
      { x: 1950, min: 1780, max: 2040 },
      { x: 2400, min: 2160, max: 3080 },
      { x: 2750, min: 2160, max: 3080 },
    ],
    goal: { x: 2980, y: 470 },
    decor: [
      { t: "sign", x: 118 }, { t: "tree", x: 230 }, { t: "bush", x: 360 },
      { t: "tree", x: 560 }, { t: "bush", x: 900 }, { t: "tree", x: 1050 },
      { t: "tree", x: 1600 }, { t: "bush", x: 1720 }, { t: "tree", x: 1900 },
      { t: "bush", x: 2020 }, { t: "tree", x: 2600 }, { t: "bush", x: 2800 },
    ],
  },
  {
    world: "1-3", name: "SUNSET RIDGE",
    width: 3400,
    spawn: { x: 70, y: 380 },
    solids: [
      rect(0, 470, 520, 90), rect(620, 470, 460, 90), rect(1180, 470, 300, 90),
      rect(1580, 470, 420, 90), rect(2100, 470, 300, 90), rect(2500, 470, 900, 90),
      rect(260, 370, 140, 24), rect(440, 290, 140, 24), rect(700, 350, 150, 24),
      rect(950, 270, 140, 24), rect(1220, 350, 140, 24), rect(1420, 270, 130, 24),
      rect(1640, 350, 150, 24), rect(1900, 260, 150, 24), rect(2180, 340, 150, 24),
      rect(2440, 260, 150, 24), rect(2720, 340, 160, 24), rect(2960, 260, 150, 24),
    ],
    coins: [
      ...line(280, 326, 3), ...line(460, 246, 3), ...line(720, 306, 3),
      ...line(970, 226, 3), ...line(1240, 306, 3), ...line(1440, 226, 3),
      ...line(1660, 306, 3), ...line(1920, 216, 3), ...line(2200, 296, 3),
      ...line(2460, 216, 3), ...line(2740, 296, 3), ...line(2980, 216, 3),
      ...arc(560, 410, 4), ...arc(1120, 410, 4), ...arc(2020, 410, 4),
    ],
    enemies: [
      { x: 430, min: 300, max: 500 },
      { x: 820, min: 640, max: 1060 },
      { x: 1300, min: 1190, max: 1460 },
      { x: 1750, min: 1600, max: 1980 },
      { x: 2200, min: 2110, max: 2380 },
      { x: 2650, min: 2520, max: 2900 },
      { x: 3050, min: 2520, max: 3380 },
    ],
    goal: { x: 3280, y: 470 },
    decor: [
      { t: "sign", x: 116 }, { t: "tree", x: 200, s: 1.1 }, { t: "bush", x: 330 },
      { t: "tree", x: 450 }, { t: "bush", x: 800 }, { t: "tree", x: 820, s: 0.9 },
      { t: "tree", x: 1300 }, { t: "bush", x: 1400 }, { t: "tree", x: 1750 },
      { t: "bush", x: 1900 }, { t: "tree", x: 2250 }, { t: "bush", x: 2320 },
      { t: "tree", x: 2820, s: 0.95 }, { t: "bush", x: 3100 },
    ],
  },
  {
    world: "1-4", name: "CLOUD DOCKS",
    width: 3000,
    spawn: { x: 80, y: 380 },
    solids: [
      rect(0, 470, 760, 90), rect(880, 470, 700, 90), rect(1700, 470, 640, 90),
      rect(2460, 470, 540, 90),
      rect(400, 380, 150, 24), rect(1060, 380, 160, 24), rect(1880, 380, 160, 24),
      rect(2620, 380, 150, 24),
    ],
    // Drifting dock planks. Rideable, and the only way to the high fish lines.
    platforms: [
      { x: 600, y: 296, w: 140, h: 18, axis: "x", range: 110, speed: 0.8, phase: 0 },
      { x: 1420, y: 300, w: 140, h: 18, axis: "x", range: 120, speed: 0.72, phase: 1.5 },
      { x: 2000, y: 320, w: 130, h: 18, axis: "y", range: 70, speed: 0.9, phase: 2.2 },
    ],
    coins: [
      ...arc(300, 404, 5), ...line(430, 324, 3), ...line(620, 252, 4),
      ...arc(1000, 404, 5), ...line(1090, 292, 3), ...line(1450, 256, 4),
      ...arc(1800, 404, 5), ...line(1910, 308, 3), ...line(2200, 404, 4),
      ...line(2650, 256, 3), ...line(2760, 380, 3),
    ],
    enemies: [
      { x: 500, min: 380, max: 720 },
      { x: 1150, min: 900, max: 1520 },
      { x: 2000, min: 1720, max: 2300 },
      { x: 2650, min: 2480, max: 2960 },
    ],
    goal: { x: 2900, y: 470 },
    decor: [
      { t: "sign", x: 120 }, { t: "tree", x: 240 }, { t: "bush", x: 340 },
      { t: "tree", x: 700 }, { t: "bush", x: 900 }, { t: "tree", x: 1120 },
      { t: "bush", x: 1300 }, { t: "tree", x: 1760 }, { t: "bush", x: 1900 },
      { t: "tree", x: 2100 }, { t: "bush", x: 2300 }, { t: "tree", x: 2500 },
      { t: "bush", x: 2760 },
    ],
  },
  {
    world: "1-5", name: "THE OLD MILL",
    width: 3400,
    spawn: { x: 70, y: 380 },
    solids: [
      rect(0, 470, 820, 90), rect(940, 470, 880, 90), rect(1920, 470, 700, 90),
      rect(2720, 470, 680, 90),
      rect(300, 380, 150, 24), rect(1180, 380, 160, 24), rect(2180, 380, 150, 24),
      rect(2860, 380, 160, 24),
    ],
    // Mill lifts: vertical, slow, and generous — stand on one and wait.
    platforms: [
      { x: 700, y: 380, w: 130, h: 18, axis: "y", range: 70, speed: 0.85, phase: 0.5 },
      { x: 1500, y: 300, w: 150, h: 18, axis: "x", range: 130, speed: 0.75, phase: 1.1 },
      { x: 2350, y: 400, w: 120, h: 18, axis: "y", range: 80, speed: 0.95, phase: 2.0 },
    ],
    coins: [
      ...arc(320, 404, 5), ...line(330, 306, 3), ...line(700, 290, 4),
      ...arc(1080, 404, 4), ...line(1210, 276, 3), ...line(1520, 256, 4),
      ...arc(2000, 404, 5), ...line(2210, 286, 3), ...line(2380, 310, 4),
      ...line(2890, 256, 4), ...arc(3100, 404, 4),
    ],
    enemies: [
      { x: 420, min: 300, max: 760 },
      { x: 1000, min: 960, max: 1400 },
      { x: 1600, min: 1420, max: 1800 },
      { x: 2100, min: 1940, max: 2560 },
      { x: 2950, min: 2740, max: 3340 },
    ],
    goal: { x: 3250, y: 470 },
    decor: [
      { t: "sign", x: 116 }, { t: "tree", x: 200, s: 1.05 }, { t: "bush", x: 420 },
      { t: "tree", x: 780 }, { t: "bush", x: 980 }, { t: "tree", x: 1300 },
      { t: "bush", x: 1900 }, { t: "tree", x: 2000 }, { t: "bush", x: 2200 },
      { t: "tree", x: 2760 }, { t: "bush", x: 3000 }, { t: "tree", x: 3200, s: 0.9 },
    ],
  },
  {
    world: "1-6", name: "HOME AT LAST",
    width: 3800,
    spawn: { x: 60, y: 380 },
    solids: [
      rect(0, 470, 640, 90), rect(760, 470, 620, 90), rect(1480, 470, 560, 90),
      rect(2140, 470, 700, 90), rect(2940, 470, 860, 90),
      rect(320, 380, 150, 24), rect(980, 380, 160, 24), rect(1700, 380, 150, 24),
      rect(2380, 380, 170, 24), rect(3120, 380, 150, 24),
    ],
    // Everything at once, on the way home.
    platforms: [
      { x: 560, y: 300, w: 150, h: 18, axis: "x", range: 130, speed: 0.8, phase: 0.3 },
      { x: 1760, y: 380, w: 120, h: 18, axis: "y", range: 80, speed: 0.9, phase: 1.7 },
      { x: 2700, y: 300, w: 150, h: 18, axis: "x", range: 120, speed: 0.7, phase: 2.6 },
    ],
    coins: [
      ...arc(280, 404, 5), ...line(350, 316, 3), ...line(840, 256, 4),
      ...arc(900, 404, 5), ...line(1010, 296, 3), ...line(1730, 286, 3),
      ...arc(1900, 404, 4), ...line(2000, 404, 3), ...line(2410, 256, 4),
      ...arc(2600, 404, 4), ...line(2730, 246, 4), ...line(3150, 236, 3),
      ...arc(3400, 404, 5),
    ],
    enemies: [
      { x: 380, min: 200, max: 600 },
      { x: 900, min: 780, max: 1340 },
      { x: 1600, min: 1500, max: 2000 },
      { x: 2300, min: 2160, max: 2800 },
      { x: 3000, min: 2960, max: 3300 },
      { x: 3400, min: 2960, max: 3740 },
    ],
    goal: { x: 3600, y: 470 },
    decor: [
      { t: "sign", x: 112 }, { t: "tree", x: 200 }, { t: "bush", x: 330 },
      { t: "tree", x: 700 }, { t: "bush", x: 900 }, { t: "tree", x: 1200 },
      { t: "bush", x: 1500 }, { t: "tree", x: 1800 }, { t: "bush", x: 2100 },
      { t: "tree", x: 2400 }, { t: "bush", x: 2600 }, { t: "tree", x: 2900 },
      { t: "bush", x: 3200, }, { t: "tree", x: 3460, s: 1.15 },
    ],
  },
  {
    world: "1-7", name: "THE DEN",
    width: 1200,
    spawn: { x: 90, y: 380 },
    boss: true,
    solids: [
      rect(0, 470, 1200, 90),
      rect(0, 0, 40, 470), rect(1160, 0, 40, 470),
      rect(150, 356, 150, 24), rect(900, 356, 150, 24),
    ],
    coins: [...line(120, 300, 3), ...line(1020, 300, 3)],
    enemies: [],
    goal: { x: 600, y: 470 },
    decor: [],
  },
];

/* ---------------------------------------------------------------- player */
const player = {
  x: 0, y: 0, w: 34, h: 42, vx: 0, vy: 0, facing: 1,
  onGround: false, coyote: 0, buf: 0, anim: "idle", animT: 0, frame: 0,
  attack: 0, cooldown: 0, invuln: 0, dead: false, spawnX: 0, spawnY: 0, ride: null,
};

function loadLevel(i) {
  const L = LEVELS[i];
  player.x = L.spawn.x; player.y = L.spawn.y;
  player.spawnX = L.spawn.x; player.spawnY = L.spawn.y;
  player.vx = player.vy = 0; player.facing = 1; player.dead = false;
  player.invuln = 0; player.attack = 0; player.cooldown = 0;
  player.anim = "idle"; player.animT = 0; player.frame = 0;
  world.level = L;
  world.coins = L.coins.map((c) => ({ x: c.x, y: c.y, got: false, t: Math.random() * 6 }));
  world.enemies = L.enemies.map((e) => ({
    x: e.x, y: 0, w: 40, h: 28, min: e.min, max: e.max,
    vx: 70, dir: 1, alive: true, t: Math.random() * 3, squash: 0,
  }));
  world.goalDef = L.goal;
  // In the boss room the cushion only appears once the Dust King coughs it up.
  world.goal = L.boss ? null : { x: L.goal.x, y: L.goal.y, t: 0 };
  world.boss = L.boss ? makeBoss(L) : null;
  world.plats = (L.platforms || []).map((q) => ({
    x: q.x, y: q.y, w: q.w, h: q.h, ox: q.x, oy: q.y,
    axis: q.axis || "x", range: q.range || 0, speed: q.speed || 0,
    phase: q.phase || 0, dx: 0, dy: 0, plat: true,
  }));
  world.particles.length = 0;
  world.cam = Math.max(0, Math.min(player.x - W * 0.36, L.width - W));
  world.total = L.coins.length;
  world.got = 0;
  state.totalCoins = L.coins.length;
  state.coins = 0;
  paused = false;
  state.mode = "play";
  document.body.classList.add("playing");
}

const world = {
  level: null, coins: [], enemies: [], particles: [], cam: 0, got: 0, total: 0,
  goal: null, time: 0, checkpoint: 0, plats: [], boss: null, goalDef: null,
};

/* ------------------------------------------------------------- collision */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidHit(box) {
  for (const s of world.level.solids) if (overlaps(box, s)) return s;
  for (const q of world.plats) if (overlaps(box, q)) return q;
  return null;
}

function movePlayer(dt) {
  const p = player;
  p.x += p.vx * dt;
  let box = rect(p.x, p.y, p.w, p.h);
  let s = solidHit(box);
  if (s) {
    if (p.vx > 0) p.x = s.x - p.w; else if (p.vx < 0) p.x = s.x + s.w;
    p.vx = 0;
  }

  p.y += p.vy * dt;
  p.onGround = false;
  p.ride = null;
  box = rect(p.x, p.y, p.w, p.h);
  s = solidHit(box);
  if (s) {
    if (p.vy > 0) {
      p.y = s.y - p.h;
      if (p.vy > 420) { sfx.land(); dust(p.x + p.w / 2, p.y + p.h, 4); }
      p.vy = 0;
      p.onGround = true;
      if (s.plat) p.ride = s;
    } else if (p.vy < 0) {
      p.y = s.y + s.h; p.vy = 0;
    }
  }
  if (p.y > H + 200) hurt(true);
}

function hurt(fell) {
  const p = player;
  if (p.dead || p.invuln > 0) return;
  state.lives--;
  state.shake = 12;
  sfx.hit();
  burst(p.x + p.w / 2, p.y + p.h / 2, 14, "#c2452f");
  if (state.lives <= 0) {
    p.dead = true; state.mode = "gameover"; state.best = Math.max(state.best, state.coins);
    setTimeout(() => { }, 0);
    return;
  }
  p.invuln = 1.4;
  if (fell) { p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; }
  else { p.vx = -p.facing * 240; p.vy = -320; }
  // Boss room: every hit is a clean retry — back to the door, boss at full health.
  if (world.boss && !world.boss.dead) {
    p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0;
    p.ride = null; p.invuln = 1.6;
    resetBoss();
  }
}

/* -------------------------------------------------------------- particles */
function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 220;
    world.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: 0.5 + Math.random() * 0.4, max: 0.9, c: color, s: 3 + Math.random() * 3 });
  }
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) {
    world.particles.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 40, life: 0.35, max: 0.35, c: "#b9a686", s: 3 });
  }
}

/* ------------------------------------------------------------------ turn */
function update(dt) {
  state.t += dt;
  if (state.mode !== "play" || paused) { updateParticles(dt); return; }

  const p = player;
  world.time += dt;

  // moving platforms: advance, then carry whoever is standing on one
  for (const q of world.plats) {
    const ph = world.time * q.speed + q.phase;
    const nx = q.axis === "x" ? q.ox + Math.sin(ph) * q.range : q.ox;
    const ny = q.axis === "y" ? q.oy + Math.sin(ph) * q.range : q.oy;
    q.dx = nx - q.x; q.dy = ny - q.y;
    q.x = nx; q.y = ny;
  }
  if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }

  // horizontal input
  const want = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (want !== 0) {
    p.vx += want * ACCEL * dt;
    p.facing = want;
    p.vx = Math.max(-MOVE, Math.min(MOVE, p.vx));
  } else {
    const s = Math.sign(p.vx);
    p.vx -= s * FRIC * dt;
    if (Math.sign(p.vx) !== s) p.vx = 0;
  }

  // jump
  p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
  if (queued.jump) { p.buf = JUMP_BUF; queued.jump = false; }
  p.buf = Math.max(0, p.buf - dt);
  if (p.buf > 0 && p.coyote > 0) {
    p.vy = JUMP_V; p.buf = 0; p.coyote = 0; p.onGround = false;
    sfx.jump(); dust(p.x + p.w / 2, p.y + p.h, 5);
  }
  if (!keys.jump && p.vy < -400) p.vy = -400;   // tapping still gives a short hop

  // attack
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (queued.bat) {
    queued.bat = false;
    if (p.cooldown <= 0) {
      p.attack = 0.26; p.cooldown = 0.36;
      sfx.bat();
      if (p.onGround) p.vx += p.facing * 90;
    }
  }
  p.attack = Math.max(0, p.attack - dt);

  p.vy = Math.min(MAXFALL, p.vy + GRAV * dt);
  movePlayer(dt);
  if (p.invuln > 0) p.invuln -= dt;

  // animation
  p.animT += dt;
  const speed = Math.abs(p.vx);
  let anim = "idle";
  if (p.attack > 0) anim = "bat";
  else if (!p.onGround) anim = "jump";
  else if (speed > 200) anim = "run";
  else if (speed > 20) anim = "walk";
  if (anim !== p.anim) { p.anim = anim; p.animT = 0; }
  const fps = anim === "run" ? 15 : anim === "walk" ? 11 : anim === "bat" ? 16 : 6;
  const frames = ATLAS[state.setIndex === 0 ? "black" : "grey"][anim];
  if (anim === "jump") {
    p.frame = p.vy < -120 ? 0 : p.vy > 200 ? 2 : 1;
  } else {
    p.frame = Math.floor(p.animT * fps) % frames.length;
  }

  // attack hitbox
  if (p.attack > 0.06 && p.attack < 0.2) {
    const hb = rect(p.facing > 0 ? p.x + p.w : p.x - 46, p.y + 2, 46, 32);
    for (const e of world.enemies) {
      if (e.alive && overlaps(hb, rect(e.x, e.y, e.w, e.h))) killEnemy(e, p.facing * 160);
    }
  }

  // enemies
  for (const e of world.enemies) {
    if (!e.alive) { e.squash = Math.max(0, e.squash - dt); continue; }
    e.t += dt;
    e.x += e.vx * dt;
    if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
    if (e.x + e.w > e.max) { e.x = e.max - e.w; e.vx = -Math.abs(e.vx); }
    // walls
    const wall = solidHit(rect(e.x, e.y - 4, e.w, e.h));
    if (wall) { e.x -= e.vx * dt; e.vx *= -1; }
    // ground snap
    let gy = 0, found = false;
    for (const s of world.level.solids) {
      if (e.x + e.w > s.x && e.x < s.x + s.w && s.y >= e.y + e.h - 6 && s.y < e.y + e.h + 40) {
        if (!found || s.y < gy) { gy = s.y; found = true; }
      }
    }
    e.y = found ? gy - e.h : e.y;

    // player collision
    const pb = rect(p.x, p.y, p.w, p.h);
    const eb = rect(e.x, e.y, e.w, e.h);
    if (!p.dead && overlaps(pb, eb)) {
      const stomping = p.vy > 120 && p.y + p.h - p.vy * dt <= e.y + 12;
      if (stomping) {
        killEnemy(e, 0);
        p.vy = -520; p.onGround = false;
        sfx.kill();
      } else hurt(false);
    }
  }

  updateBoss(dt);

  // coins
  for (const c of world.coins) {
    if (c.got) continue;
    c.t += dt;
    if (overlaps(rect(p.x, p.y, p.w, p.h), rect(c.x - 12, c.y - 12, 24, 24))) {
      c.got = true; state.coins++; state.fish++; world.got++;
      sfx.coin();
      burst(c.x, c.y, 8, "#f2c14e");
    }
  }

  // checkpoint
  if (p.x > state.checkpoint + 200) state.checkpoint = p.x;

  // goal
  if (world.goal && overlaps(rect(p.x, p.y, p.w, p.h), rect(world.goal.x - 66, world.goal.y - 92, 132, 92))) {
    state.mode = "clear"; sfx.win(); state.shake = 6;
    burst(world.goal.x, world.goal.y - 40, 30, "#f2c14e");
  }

  // camera
  const target = Math.max(0, Math.min(p.x + p.w / 2 - W * 0.42, world.level.width - W));
  world.cam += (target - world.cam) * Math.min(1, dt * 8);

  updateParticles(dt);
  state.shake = Math.max(0, state.shake - dt * 40);
}

/* ------------------------------------------------------------- the boss */
function makeBoss(L) {
  return {
    x: L.width - 300, y: 470 - 72, w: 104, h: 72,
    hp: 3, maxHp: 3, state: "patrol", t: 0, dir: -1, timer: 2.2,
    vx: 0, stun: 0, invuln: 0, flash: 0, spin: 0, dead: false, deadT: 0,
  };
}

function resetBoss() {
  const L = world.level;
  const b = makeBoss(L);
  world.boss = b;
}

function killBoss() {
  const b = world.boss;
  b.dead = true; b.deadT = 0; b.hp = 0;
  state.shake = 16;
  sfx.bossDie();
  burst(b.x + b.w / 2, b.y + b.h / 2, 40, "#8E7B5E");
  burst(b.x + b.w / 2, b.y + b.h / 2, 24, "#C8A46A");
}

function updateBoss(dt) {
  const b = world.boss;
  if (!b) return;
  const p = player;

  if (b.dead) {
    b.deadT += dt;
    if (b.deadT > 0.9 && !world.goal) {
      world.goal = { x: world.goalDef.x, y: world.goalDef.y, t: 0 };
      burst(world.goalDef.x, world.goalDef.y - 50, 26, "#f2c14e");
    }
    return;
  }

  b.t += dt;
  b.spin += dt * (b.state === "charge" ? 30 : 6);
  b.flash = Math.max(0, b.flash - dt);
  b.invuln = Math.max(0, b.invuln - dt);

  const minX = 44, maxX = world.level.width - 44 - b.w;

  if (b.state === "patrol") {
    b.dir = (p.x + p.w / 2) < (b.x + b.w / 2) ? -1 : 1;
    b.x += b.dir * (95 + (b.maxHp - b.hp) * 40) * dt;
    b.timer -= dt;
    if (b.timer <= 0 && Math.abs((p.x + p.w / 2) - (b.x + b.w / 2)) < 560) {
      b.state = "telegraph"; b.t = 0; sfx.charge();
    }
  } else if (b.state === "telegraph") {
    if (b.t > 0.55) {
      b.state = "charge"; b.t = 0;
      b.vx = b.dir * (640 + (b.maxHp - b.hp) * 80);
    }
  } else if (b.state === "charge") {
    b.x += b.vx * dt;
    if (b.x <= minX || b.x >= maxX) {
      b.x = Math.max(minX, Math.min(maxX, b.x));
      b.state = "stun"; b.stun = 2.5; b.vx = 0;
      state.shake = 12; sfx.clank();
      dust(b.x + b.w / 2, b.y + b.h, 12);
    }
  } else if (b.state === "stun") {
    b.stun -= dt;
    if (b.stun <= 0) { b.state = "patrol"; b.timer = 1.5; }
  } else if (b.state === "hurt") {
    b.x += b.vx * dt; b.vx *= 0.88;
    if (b.t > 0.6) { b.state = "patrol"; b.timer = 1.1; }
  }

  b.x = Math.max(minX, Math.min(maxX, b.x));

  const pb = rect(p.x, p.y, p.w, p.h);
  const bb = rect(b.x, b.y, b.w, b.h);
  if (!p.dead && overlaps(pb, bb)) {
    const stomping = p.vy > 120 && p.y + p.h - p.vy * dt <= b.y + 16;
    if (stomping) {
      if (b.state === "stun" && b.invuln <= 0) {
        b.hp--; b.flash = 0.45; b.invuln = 0.7;
        b.state = "hurt"; b.t = 0; b.vx = -b.dir * 280;
        p.vy = -540; p.onGround = false;
        p.invuln = 0.4;   // stay inside the shell for a frame while bouncing out
        state.shake = 12; sfx.bossHit();
        burst(b.x + b.w / 2, b.y + 10, 18, "#C8A46A");
        if (b.hp <= 0) killBoss();
      } else {
        p.vy = -440; p.invuln = 0.25; sfx.clank();
        burst(p.x + p.w / 2, p.y + p.h, 6, "#9E8B6B");
      }
    } else {
      hurt(false);
    }
  }
}

function killEnemy(e, knock) {
  e.alive = false; e.squash = 0.25;
  burst(e.x + e.w / 2, e.y + e.h / 2, 12, "#8a7c6a");
  if (knock) { /* no body physics, just particles */ }
}

function updateParticles(dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) { world.particles.splice(i, 1); continue; }
    p.vy += 900 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

/* ------------------------------------------------------------------ draw */
function cloud(x, y, s) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x, y + 10 * s, 52 * s, 12 * s);
  ctx.fillRect(x + 8 * s, y + 3 * s, 34 * s, 9 * s);
  ctx.fillRect(x + 18 * s, y - 4 * s, 18 * s, 8 * s);
  ctx.fillStyle = "#DCEFFB";
  ctx.fillRect(x, y + 22 * s, 52 * s, 4 * s);
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, 470);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.55, C.skyMid);
  g.addColorStop(1, C.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 470);

  const cam = world.cam || 0;

  ctx.fillStyle = "rgba(255,250,220,0.9)";
  ctx.beginPath(); ctx.arc(W - 136, 96, 42, 0, 7); ctx.fill();

  for (let i = 0; i < 6; i++) {
    const x = ((i * 380 - cam * 0.08) % 2280 + 2280) % 2280 - 140;
    cloud(x, 54 + (i % 3) * 46, 1 + (i % 2) * 0.3);
  }

  // far mountain range
  const off = ((-cam * 0.14) % 420 + 420) % 420;
  for (let i = 0; i < 6; i++) {
    const bx = i * 420 + off - 420;
    ctx.fillStyle = C.mountMid;
    ctx.beginPath();
    ctx.moveTo(bx - 40, 470); ctx.lineTo(bx + 170, 236); ctx.lineTo(bx + 380, 470);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.mountHi;
    ctx.beginPath();
    ctx.moveTo(bx + 170, 236); ctx.lineTo(bx + 250, 350); ctx.lineTo(bx + 170, 380);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.mountFar;
    ctx.beginPath();
    ctx.moveTo(bx + 170, 380); ctx.lineTo(bx + 250, 350); ctx.lineTo(bx + 380, 470);
    ctx.lineTo(bx + 170, 470); ctx.closePath(); ctx.fill();
  }

  // castle on the far ridge
  const cx = ((520 - cam * 0.14) % 2600 + 2600) % 2600 - 200;
  drawCastle(cx, 470);

  // forest ridge
  const off2 = ((-cam * 0.3) % 300 + 300) % 300;
  for (let i = 0; i < 7; i++) {
    const bx = i * 300 + off2 - 300;
    ctx.fillStyle = C.forestDark;
    ctx.beginPath(); ctx.ellipse(bx + 150, 486, 210, 92, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = C.forest;
    ctx.beginPath(); ctx.ellipse(bx + 150, 492, 190, 78, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = C.forestHi;
    for (let k = 0; k < 5; k++) {
      const tx = bx + 40 + k * 52 + ((i * 17 + k * 29) % 18);
      const ty = 470 - ((i * 7 + k * 13) % 26);
      ctx.fillRect(tx, ty, 7, 7); ctx.fillRect(tx + 3, ty - 6, 5, 8);
    }
  }
}

function drawCastle(x, baseY) {
  const s = 1;
  ctx.fillStyle = C.mountFar;
  ctx.fillRect(x, baseY - 58 * s, 20 * s, 58 * s);
  ctx.fillRect(x + 44, baseY - 74 * s, 22 * s, 74 * s);
  ctx.fillRect(x + 90, baseY - 50 * s, 18 * s, 50 * s);
  ctx.fillStyle = C.roofDark;
  ctx.beginPath(); ctx.moveTo(x - 4, baseY - 58 * s); ctx.lineTo(x + 10 * s, baseY - 84 * s); ctx.lineTo(x + 24 * s, baseY - 58 * s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 40, baseY - 74 * s); ctx.lineTo(x + 55 * s, baseY - 104 * s); ctx.lineTo(x + 70 * s, baseY - 74 * s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 86, baseY - 50 * s); ctx.lineTo(x + 99 * s, baseY - 70 * s); ctx.lineTo(x + 112 * s, baseY - 50 * s); ctx.fill();
}

function drawWater() {
  const top = 470;
  ctx.fillStyle = C.water;
  ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = C.waterDeep;
  ctx.fillRect(0, top + 30, W, H - top - 30);

  const cam = world.cam;
  ctx.fillStyle = C.waterHi;
  for (let i = 0; i < 13; i++) {
    const x = ((i * 140 - cam * 0.55) % 1820 + 1820) % 1820 - 110;
    const y = top + 9 + ((i * 37) % 34);
    ctx.fillRect(Math.round(x), Math.round(y), 30 + (i % 3) * 12, 3);
  }
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 220 - cam * 0.32) % 1760 + 1760) % 1760 - 90;
    ctx.fillRect(Math.round(x), top + 26 + ((i * 53) % 30), 16, 2);
  }
  // shoreline
  ctx.fillStyle = "#D9C9A3";
  for (let i = 0; i < 20; i++) {
    const x = ((i * 120 - cam * 0.7) % 2400 + 2400) % 2400 - 100;
    ctx.fillRect(Math.round(x), top - 2, 26, 3);
  }
}

function drawTree(x, groundY, s = 1) {
  const h = 96 * s;
  ctx.fillStyle = "#6D4C41";
  ctx.fillRect(x - 7 * s, groundY - h * 0.52, 14 * s, h * 0.52);
  ctx.fillStyle = "#4E342E";
  ctx.fillRect(x + 2 * s, groundY - h * 0.52, 4 * s, h * 0.52);
  const cy = groundY - h * 0.72;
  ctx.fillStyle = C.forestDark;
  ctx.beginPath(); ctx.ellipse(x, cy + 8 * s, 44 * s, 34 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.forest;
  ctx.beginPath(); ctx.ellipse(x - 6 * s, cy, 40 * s, 30 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.forestHi;
  ctx.beginPath(); ctx.ellipse(x - 14 * s, cy - 10 * s, 20 * s, 15 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.forestHi;
  ctx.fillRect(x - 24 * s, cy - 2 * s, 6 * s, 6 * s);
  ctx.fillRect(x + 10 * s, cy + 6 * s, 5 * s, 5 * s);
}

function drawBush(x, groundY) {
  ctx.fillStyle = C.forestDark;
  ctx.beginPath(); ctx.ellipse(x, groundY - 10, 30, 20, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = C.forest;
  ctx.beginPath(); ctx.ellipse(x - 3, groundY - 12, 27, 17, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = C.forestHi;
  ctx.fillRect(x - 12, groundY - 24, 5, 5);
}

function drawSign(x, groundY) {
  ctx.fillStyle = "#6D4C41";
  ctx.fillRect(x - 3, groundY - 46, 7, 46);
  ctx.fillStyle = "#8D6E63";
  ctx.fillRect(x - 30, groundY - 66, 64, 26);
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(x - 30, groundY - 66, 64, 3);
  text("GO!", x + 2, groundY - 60, 2, "#FFEB3B", "center");
  ctx.fillStyle = "#FFEB3B";
  ctx.fillRect(x + 20, groundY - 54, 8, 3);
}

function drawDecor() {
  const L = world.level;
  if (!L || !L.decor) return;
  const cam = world.cam;
  for (const d of L.decor) {
    const x = Math.round(d.x - cam);
    if (x < -140 || x > W + 140) continue;
    if (d.t === "tree") drawTree(x, d.y || 470, d.s || 1);
    else if (d.t === "bush") drawBush(x, d.y || 470);
    else if (d.t === "sign") drawSign(x, d.y || 470);
  }
}

function drawSolids() {
  const cam = world.cam;
  for (const s of world.level.solids) {
    if (s.x + s.w < cam - 40 || s.x > cam + W + 40) continue;
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    const big = s.h > 40;

    // dirt body
    ctx.fillStyle = C.dirt;
    ctx.fillRect(x, y, s.w, s.h);

    // chunky dirt speckle
    ctx.fillStyle = C.dirtDark;
    for (let px = 8; px < s.w - 8; px += 24) {
      for (let py = 16; py < s.h - 6; py += 26) {
        const n = (px * 7 + py * 13 + Math.round(s.x)) % 5;
        if (n < 2) ctx.fillRect(x + px, y + py, 9, 6);
        else if (n === 2) ctx.fillRect(x + px + 7, y + py + 5, 5, 4);
      }
    }
    ctx.fillStyle = C.dirtHi;
    for (let px = 16; px < s.w - 10; px += 36) {
      ctx.fillRect(x + px, y + 22 + ((px * 3) % 16), 7, 4);
    }

    // grass cap
    const cap = big ? 14 : 10;
    ctx.fillStyle = C.grassDark;
    ctx.fillRect(x, y, s.w, cap);
    ctx.fillStyle = C.grass;
    ctx.fillRect(x, y, s.w, cap - 4);
    ctx.fillStyle = C.grassHi;
    ctx.fillRect(x, y, s.w, 3);

    // scalloped lip
    ctx.fillStyle = C.grassDark;
    for (let px = 0; px < s.w; px += 11) {
      const d = 3 + ((px * 7 + Math.round(s.x)) % 3);
      ctx.fillRect(x + px, y + cap - 2, 7, d);
    }

    // bottom shade
    ctx.fillStyle = C.dirtDark;
    ctx.fillRect(x, y + s.h - 4, s.w, 4);
  }
}

function drawPlatforms() {
  const cam = world.cam;
  for (const q of world.plats) {
    if (q.x + q.w < cam - 80 || q.x > cam + W + 80) continue;
    const x = Math.round(q.x - cam), y = Math.round(q.y);

    ctx.fillStyle = "rgba(8,18,26,0.20)";
    ctx.fillRect(x + 4, y + q.h + 2, q.w - 8, 5);

    ctx.fillStyle = "#7B5E3B";
    ctx.fillRect(x, y, q.w, q.h);
    ctx.fillStyle = "#5B4329";
    ctx.fillRect(x, y + q.h - 5, q.w, 5);
    ctx.fillStyle = "#C8A46A";
    ctx.fillRect(x, y, q.w, 4);

    ctx.fillStyle = "#3E2E1C";
    for (let px = 8; px < q.w - 6; px += 18) ctx.fillRect(x + px, y + 7, 3, 3);

    ctx.fillStyle = "#9E8B6B";
    ctx.fillRect(x - 2, y, 4, q.h);
    ctx.fillRect(x + q.w - 2, y, 4, q.h);
  }
}

function drawCoin(c) {
  const bob = Math.sin(c.t * 4) * 3;
  const x = Math.round(c.x - world.cam);
  const y = Math.round(c.y + bob);
  // little fish: body, tail, fin, eye
  ctx.fillStyle = "#B71C1C";
  ctx.fillRect(x - 10, y - 5, 18, 10);
  ctx.fillRect(x - 15, y - 8, 6, 7);
  ctx.fillRect(x - 15, y + 1, 6, 7);
  ctx.fillStyle = C.red;
  ctx.fillRect(x - 9, y - 6, 17, 9);
  ctx.fillStyle = "#FF8A80";
  ctx.fillRect(x - 7, y - 4, 12, 3);
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + 1, y - 4, 3, 3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 2, y - 3, 2, 2);
  ctx.fillStyle = "#B71C1C";
  ctx.fillRect(x - 6, y + 3, 8, 2);
  // sparkle
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(x + 9, y - 8, 2, 4);
  ctx.fillRect(x + 8, y - 7, 4, 2);
}

function drawEnemy(e) {
  const x = Math.round(e.x - world.cam), y = Math.round(e.y);
  if (!e.alive) {
    if (e.squash > 0) {
      ctx.fillStyle = "#7A4B3A";
      ctx.fillRect(x + 4, y + e.h - 8, e.w - 8, 8);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x + 8, y + e.h - 5, 6, 3);
    }
    return;
  }
  const wob = Math.sin(e.t * 8) * 1.5;
  // bird body
  ctx.fillStyle = "#8E2A20";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h * 0.55, 17, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#C0392B";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h * 0.5, 15, 11, 0, 0, 7); ctx.fill();
  // belly
  ctx.fillStyle = "#F5D6A0";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2 + 2, y + e.h * 0.66, 9, 6, 0, 0, 7); ctx.fill();
  // head
  ctx.fillStyle = "#C0392B";
  ctx.beginPath(); ctx.arc(x + e.w / 2 + 8, y + e.h * 0.34 + wob, 8, 0, 7); ctx.fill();
  // beak
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + e.w / 2 + 15, y + e.h * 0.33 + wob, 7, 4);
  ctx.fillStyle = "#E6A700";
  ctx.fillRect(x + e.w / 2 + 15, y + e.h * 0.38 + wob, 6, 2);
  // eye
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + e.w / 2 + 8, y + e.h * 0.3 + wob, 4, 4);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + e.w / 2 + 9, y + e.h * 0.31 + wob, 2, 2);
  // wing
  ctx.fillStyle = "#7B2118";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2 - 5, y + e.h * 0.55, 9, 5, -0.3, 0, 7); ctx.fill();
  // feet
  ctx.fillStyle = "#E6A700";
  ctx.fillRect(x + e.w / 2 - 2, y + e.h - 4, 3, 4);
  ctx.fillRect(x + e.w / 2 + 7, y + e.h - 4, 3, 4);
}

function drawGoal() {
  const g = world.goal; if (!g) return;
  const x = Math.round(g.x - world.cam), y = g.y;
  const w = 148, h = 104;
  const x0 = x - w / 2, y0 = y - h;

  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath(); ctx.ellipse(x, y + 2, w * 0.52, 9, 0, 0, 7); ctx.fill();

  // stone walls
  ctx.fillStyle = C.stone;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = C.stoneDark;
  for (let py = y0 + 10; py < y; py += 15) {
    ctx.fillRect(x0, py, w, 2);
    const off = ((py / 15) % 2) ? 8 : 26;
    for (let px = x0 + off; px < x0 + w - 4; px += 36) ctx.fillRect(px, py, 2, 15);
  }

  // roof
  ctx.fillStyle = C.roof;
  ctx.beginPath();
  ctx.moveTo(x0 - 14, y0 + 4); ctx.lineTo(x, y0 - 48); ctx.lineTo(x0 + w + 14, y0 + 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.roofDark;
  ctx.beginPath();
  ctx.moveTo(x0 - 14, y0 + 4); ctx.lineTo(x, y0 - 48); ctx.lineTo(x, y0 + 4);
  ctx.closePath(); ctx.fill();

  // door
  const dw = 42, dh = 56;
  ctx.fillStyle = "#2E1B12";
  ctx.fillRect(x - dw / 2, y - dh, dw, dh);
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(x - dw / 2 + 3, y - dh + 3, dw - 6, dh - 3);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + dw / 2 - 9, y - dh / 2, 3, 3);

  // paw print on the door
  ctx.fillStyle = "#E8DCC0";
  ctx.beginPath(); ctx.ellipse(x, y - 26, 6, 5, 0, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-7, -8], [-2, -11], [4, -11], [8, -7]]) {
    ctx.beginPath(); ctx.arc(x + dx, y - 26 + dy, 2.4, 0, 7); ctx.fill();
  }

  // GOAL plaque
  ctx.fillStyle = "#2E1B12";
  ctx.fillRect(x - 34, y0 + 8, 68, 22);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x - 32, y0 + 10, 64, 18);
  text("GOAL", x, y0 + 14, 2, "#2E1B12", "center");

  // sleeping cat waiting by the door
  drawSleepingCat(x - 96, y);
}

function drawSleepingCat(baseX, groundY) {
  const frames = (ATLAS.black.sleep && ATLAS.black.sleep.length) ? ATLAS.black.sleep : ATLAS.black.rest;
  if (!frames) return;
  const f = frames[Math.floor(state.t * 2) % frames.length];
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, Math.round(baseX - f.w / 2), groundY - f.h + (f.foot || 0), f.w, f.h);

  // Zzz
  for (let i = 0; i < 3; i++) {
    const p = ((state.t * 0.55 + i / 3) % 1);
    const zx = baseX + 22 + p * 26;
    const zy = groundY - 46 - p * 46;
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
    text("Z", zx, zy, 1 + Math.floor(p * 2), "#FFFFFF");
    ctx.globalAlpha = 1;
  }
}

function drawBoss() {
  const b = world.boss;
  if (!b) return;
  const x = Math.round(b.x - world.cam), y = Math.round(b.y);
  const cx = x + b.w / 2, cy = y + b.h / 2;

  ctx.fillStyle = "rgba(8,18,26,0.25)";
  ctx.beginPath(); ctx.ellipse(cx, y + b.h - 2, b.w * 0.48, 9, 0, 0, 7); ctx.fill();

  if (b.dead) {
    ctx.fillStyle = "#4A4238";
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, b.w * 0.46, b.h * 0.26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#C8A46A";
    ctx.fillRect(cx - 10, cy + 2, 20, 6);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "rgba(180,170,150,0.5)";
      ctx.fillRect(cx - 30 + i * 22, cy - 14 - i * 6, 8, 8);
    }
    return;
  }

  // spinning brush skirt
  ctx.strokeStyle = "#6B5A44"; ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const a = b.spin + i * (Math.PI / 5);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 22);
    ctx.lineTo(cx + Math.cos(a) * 54, cy + Math.sin(a) * 33);
    ctx.stroke();
  }

  // shell
  ctx.fillStyle = b.flash > 0 ? "#F6E7C8" : "#3A3630";
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.46, b.h * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = b.flash > 0 ? "#FFF8E7" : "#5A5348";
  ctx.beginPath(); ctx.ellipse(cx, cy - 7, b.w * 0.38, b.h * 0.30, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = "#8E8271"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.46, b.h * 0.42, 0, 0, 7); ctx.stroke();

  // the cushion it swallowed, visible through the intake
  ctx.fillStyle = "#C2452F";
  ctx.fillRect(cx - 13, cy + 4, 26, 8);
  ctx.fillStyle = "#E8B44A";
  ctx.fillRect(cx - 13, cy + 4, 26, 2);

  // eye
  const angry = b.state === "charge" || b.state === "telegraph";
  const ex = cx + b.dir * 12;
  ctx.fillStyle = angry ? "#E53935" : "#8CD9F2";
  ctx.beginPath(); ctx.arc(ex, cy - 10, angry ? 7 : 5, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(ex - 2, cy - 13, 3, 3);

  // telegraph tremble
  if (b.state === "telegraph") {
    ctx.fillStyle = "rgba(229,57,53,0.20)";
    ctx.fillRect(x - 10, y - 10, b.w + 20, b.h + 12);
  }

  // stun stars
  if (b.state === "stun") {
    for (let i = 0; i < 3; i++) {
      const a = state.t * 6 + i * 2.1;
      const sx = cx + Math.cos(a) * 34, sy = cy - 40 + Math.sin(a) * 8;
      ctx.fillStyle = C.gold;
      ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 6, 6);
    }
  }
}

function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
  const set = state.setIndex === 0 ? "black" : "grey";
  const frames = ATLAS[set][p.anim] || ATLAS[set].idle;
  const f = frames[Math.min(p.frame, frames.length - 1)];
  const x = Math.round(p.x + p.w / 2 - world.cam);
  const y = Math.round(p.y + p.h);
  ctx.save();
  ctx.translate(x, y);
  if (p.facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, -Math.round(f.w / 2), -f.h + (f.foot || 0), f.w, f.h);
  ctx.restore();

  // attack swipe
  if (p.attack > 0.06 && p.attack < 0.2) {
    const ax = p.x + (p.facing > 0 ? p.w + 6 : -6) - world.cam;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(Math.round(ax + p.facing * i * 7), Math.round(p.y + 6 + i * 8), 6, 3);
    }
  }
}

function panel(x, y, w, h, r = 10) {
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function textShadow(str, x, y, s, color, align = "left") {
  text(str, x + s, y + s, s, "rgba(8,24,40,0.35)", align);
  text(str, x, y, s, color, align);
}

function keycap(label, x, y, w, s = 1) {
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x, y, w, 16);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 15);
  text(label, x + w / 2, y + 4, s, "#FFFFFF", "center");
}

function fishGlyph(x, y) {
  ctx.fillStyle = "#B71C1C";
  ctx.fillRect(x, y + 2, 16, 8);
  ctx.fillRect(x - 5, y, 5, 5);
  ctx.fillRect(x - 5, y + 7, 5, 5);
  ctx.fillStyle = C.red;
  ctx.fillRect(x + 1, y + 3, 14, 6);
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + 9, y + 4, 2, 2);
}

function drawHUD() {
  const L = LEVELS[state.level];

  // ---- top-left status ----
  panel(16, 14, 262, 50);
  // portrait
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(24, 20, 38, 38);
  const set = state.setIndex === 0 ? "black" : "grey";
  const idle = ATLAS[set].idle;
  const pf = idle[Math.floor(state.t * 4) % idle.length];
  ctx.save();
  ctx.beginPath(); ctx.rect(24, 20, 38, 38); ctx.clip();
  const pw = pf.w * 0.5, ph = pf.h * 0.5;
  ctx.drawImage(atlasImg, pf.x, pf.y, pf.w, pf.h,
    24 + 19 - pw / 2, 20 + 38 - ph + (pf.foot || 0) * 0.5, pw, ph);
  ctx.restore();

  // hearts
  for (let i = 0; i < 3; i++) {
    const on = i < state.lives;
    const x = 72 + i * 22, y = 26;
    ctx.fillStyle = on ? C.red : "rgba(255,255,255,0.16)";
    ctx.fillRect(x + 2, y, 5, 3); ctx.fillRect(x + 12, y, 5, 3);
    ctx.fillRect(x, y + 3, 19, 7);
    ctx.fillRect(x + 3, y + 10, 13, 3);
    ctx.fillRect(x + 6, y + 13, 7, 3);
    if (on) { ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(x + 3, y + 4, 4, 3); }
  }

  // fish count
  fishGlyph(158, 27);
  text(`X ${state.coins}/${state.totalCoins}`, 182, 26, 2, "#FFFFFF");

  // ---- top-right world plate ----
  panel(W - 262, 14, 246, 50);
  text(`WORLD ${L.world}`, W - 32, 24, 1, "rgba(255,255,255,0.7)", "right");
  text(L.name, W - 32, 38, 2, "#FFFFFF", "right");

  // ---- boss health ----
  if (world.boss && !world.boss.dead) {
    const bw = 300, bx = W / 2 - bw / 2;
    panel(bx, 14, bw, 50);
    text("THE DUST KING", W / 2, 22, 1, "rgba(255,255,255,0.72)", "center");
    for (let i = 0; i < world.boss.maxHp; i++) {
      const on = i < world.boss.hp;
      const x = W / 2 - (world.boss.maxHp * 34) / 2 + i * 34;
      ctx.fillStyle = on ? C.red : "rgba(255,255,255,0.16)";
      ctx.fillRect(x, 34, 28, 18);
      if (on) { ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(x + 3, 37, 22, 4); }
    }
    if (world.boss.state === "stun") {
      ctx.globalAlpha = 0.6 + Math.sin(state.t * 12) * 0.4;
      text("STOMP IT!", W / 2, 96, 2, "#FFEB3B", "center");
      ctx.globalAlpha = 1;
    }
  }

  // ---- first-room tutorial (top centre, clear of the play area) ----
  if (state.level === 0 && state.t < 11) {
    const fade = state.t > 9 ? Math.max(0, (11 - state.t) / 2) : 1;
    ctx.globalAlpha = fade;
    panel(W / 2 - 250, 78, 500, 56);
    text("HELP THE CAT REACH HOME!", W / 2, 92, 2, "#FFFFFF", "center");
    text("COLLECT FISH, AVOID BIRDS, FIND THE GOAL.", W / 2, 116, 1, "rgba(255,255,255,0.78)", "center");
    ctx.globalAlpha = 1;
  }

  // ---- control legend ----
  panel(W - 296, H - 76, 280, 42);
  keycap("<", W - 280, H - 64, 18);
  keycap(">", W - 258, H - 64, 18);
  text("MOVE", W - 232, H - 60, 1, "rgba(255,255,255,0.8)");
  keycap("Z", W - 186, H - 64, 18);
  text("JUMP", W - 164, H - 60, 1, "rgba(255,255,255,0.8)");
  keycap("X", W - 120, H - 64, 18);
  text("PAW", W - 98, H - 60, 1, "rgba(255,255,255,0.8)");

  if (paused) {
    ctx.fillStyle = "rgba(8,16,24,0.6)"; ctx.fillRect(0, 0, W, H);
    text("PAUSED", W / 2, H / 2 - 40, 5, "#FFFFFF", "center");
    text("P TO RESUME", W / 2, H / 2 + 30, 2, "rgba(255,255,255,0.75)", "center");
  }
  if (state.muted) text("MUTED", W - 32, 74, 1, "rgba(255,255,255,0.6)", "right");
}

function drawTitle() {
  drawSky();

  // ground strip
  ctx.fillStyle = C.dirt; ctx.fillRect(0, 470, W, 70);
  ctx.fillStyle = C.grass; ctx.fillRect(0, 470, W, 12);
  ctx.fillStyle = C.grassHi; ctx.fillRect(0, 470, W, 3);
  ctx.fillStyle = C.dirtDark;
  for (let x = 8; x < W; x += 30) ctx.fillRect(x, 494 + ((x * 7) % 20), 10, 6);

  drawTree(120, 470, 1.1);
  drawTree(838, 470, 1);
  drawBush(250, 470);
  drawBush(700, 470);

  textShadow("CAT HERO", W / 2, 84, 9, "#FFFFFF", "center");
  textShadow("A VERY SMALL ADVENTURE", W / 2, 172, 2, "#FFF8D6", "center");

  const set = state.setIndex === 0 ? "black" : "grey";
  const idle = ATLAS[set].idle;
  const f = idle[Math.floor(state.t * 6) % idle.length];
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, W / 2 - f.w, 470 - f.h * 2, f.w * 2, f.h * 2);

  const blink = Math.sin(state.t * 4) > -0.2;
  if (blink) {
    panel(W / 2 - 150, 236, 300, 46);
    text("PRESS ENTER OR TAP", W / 2, 250, 2, "#FFFFFF", "center");
  }
  panel(W / 2 - 220, 296, 440, 34);
  text("ARROWS MOVE   SPACE JUMP   J PAW", W / 2, 306, 2, "#FFF8D6", "center");
}

function drawSelect() {
  drawSky();
  textShadow("CHOOSE YOUR HERO", W / 2, 58, 4, "#FFFFFF", "center");
  const opts = [
    { key: "black", label: "BLACK CAT", sub: "NIMBLE" },
    { key: "grey", label: "GREY CAT", sub: "STEADY" },
  ];
  opts.forEach((o, i) => {
    const cx = W / 2 + (i === 0 ? -190 : 190);
    const sel = state.setIndex === i;
    panel(cx - 140, 132, 280, 286, 14);
    if (sel) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 140, 132, 280, 286);
    }

    const frames = ATLAS[o.key].idle;
    const f = frames[Math.floor(state.t * 6) % frames.length];
    ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, cx - f.w, 372 - f.h * 2, f.w * 2, f.h * 2);
    text(o.label, cx, 386, 2, "#FFFFFF", "center");
    text(o.sub, cx, 410, 1, "rgba(255,255,255,0.65)", "center");
    if (sel) text("*", cx, 112, 3, C.gold, "center");
  });
  textShadow("ARROWS OR TAP TO SWITCH   ENTER TO START", W / 2, 480, 1, "#FFF8D6", "center");
}

function drawOverlayCard(title, sub, color) {
  ctx.fillStyle = "rgba(20,16,13,0.72)"; ctx.fillRect(0, 0, W, H);
  text(title, W / 2, H / 2 - 60, 6, color, "center");
  if (sub) text(sub, W / 2, H / 2 + 30, 2, "#e8dcc0", "center");
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (state.mode === "title") { drawTitle(); return; }
  if (state.mode === "select") { drawSelect(); return; }

  const sh = state.shake;
  const ox = sh ? (Math.random() - 0.5) * sh : 0;
  const oy = sh ? (Math.random() - 0.5) * sh : 0;
  ctx.save();
  ctx.translate(Math.round(ox), Math.round(oy));

  drawSky();
  drawWater();
  drawDecor();
  drawSolids();
  drawPlatforms();
  drawGoal();
  for (const c of world.coins) if (!c.got) drawCoin(c);
  for (const e of world.enemies) drawEnemy(e);
  if (world.boss) drawBoss();
  drawPlayer();
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x - world.cam), Math.round(p.y), p.s, p.s);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  drawHUD();

  if (state.mode === "clear") {
    drawOverlayCard("CLEAR!", `FISH ${state.coins}/${state.totalCoins}`, "#f2c14e");
    text("ENTER FOR NEXT", W / 2, H / 2 + 80, 2, "#e8dcc0", "center");
  }
  if (state.mode === "gameover") {
    drawOverlayCard("GAME OVER", `FISH ${state.coins}`, "#c2452f");
    text("ENTER TO TRY AGAIN", W / 2, H / 2 + 80, 2, "#e8dcc0", "center");
  }
  if (state.mode === "win") {
    drawSky();
    ctx.fillStyle = "rgba(8,16,24,0.55)"; ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 350, 70, 700, 400, 18);
    text("HERO OF THE HOUSE", W / 2, 120, 5, "#FFFFFF", "center");
    text(`ALL ${LEVELS.length} MEADOWS CLEARED`, W / 2, 200, 2, "rgba(255,255,255,0.8)", "center");
    text(`FISH ${state.fish}`, W / 2, 246, 3, C.gold, "center");
    ["black", "grey"].forEach((set, i) => {
      const fr = ATLAS[set].idle;
      const f = fr[Math.floor(state.t * 5 + i) % fr.length];
      const x = W / 2 + (i === 0 ? -150 : 90);
      ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, x, 380 - f.h * 1.6, f.w * 1.6, f.h * 1.6);
    });
    text("ENTER TO PLAY AGAIN", W / 2, 430, 2, "#FFFFFF", "center");
  }
}

/* ------------------------------------------------------------------ loop */
let last = performance.now(), acc = 0;
const STEP = 1 / 120;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }

  // menu confirm
  if (queued.confirm) {
    queued.confirm = false;
    if (state.mode === "title") { state.mode = "select"; beep(660, 0.07, "square", 0.08); }
    else if (state.mode === "select") { state.level = 0; state.lives = 3; state.checkpoint = 0; loadLevel(0); beep(880, 0.09, "square", 0.09); }
    else if (state.mode === "clear") {
      state.level++;
      if (state.level >= LEVELS.length) { state.mode = "win"; }
      else { state.checkpoint = 0; loadLevel(state.level); }
    } else if (state.mode === "gameover" || state.mode === "win") {
      state.mode = "title"; state.lives = 3; state.level = 0; state.coins = 0; state.fish = 0;
      document.body.classList.remove("playing");
    }
  }
  if (state.mode === "play" && (keys.confirm || queued.confirm)) { /* noop */ }

  render();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ boot */
function fit() {
  const raw = Math.min(innerWidth / W, innerHeight / H);
  const s = raw >= 1 ? Math.floor(raw * 2) / 2 : raw;   // keep 0.5 steps: no smeared pixels
  canvas.style.width = Math.round(W * s) + "px";
  canvas.style.height = Math.round(H * s) + "px";
}
addEventListener("resize", fit);

function toggleMute() {
  state.muted = !state.muted;
  try { localStorage.setItem("cath hero muted", state.muted ? "1" : "0"); } catch (e) { }
}

function boot() {
  try { state.muted = localStorage.getItem("cath hero muted") === "1"; } catch (e) { }
  ATLAS = window.__CAT_ATLAS__;
  fit();
  window.__GAME = { state, player, world, LEVELS, keys, queued, loadLevel };
  requestAnimationFrame(frame);
}

fetch("assets/cat-atlas.json").then((r) => r.json()).then((j) => {
  window.__CAT_ATLAS__ = j;
  atlasImg.onload = boot;
  atlasImg.src = "assets/cat-atlas.png";
}).catch((e) => {
  ctx.fillStyle = "#f0e6c8"; ctx.fillRect(0, 0, W, H);
  text("ATLAS FAILED TO LOAD", W / 2, H / 2, 3, "#c2452f", "center");
  console.error(e);
});

})();
