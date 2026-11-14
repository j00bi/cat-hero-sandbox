/* CAT HERO — a small pixel platformer built around the sprite sheet.
   No dependencies. Canvas 2D at a fixed 960x540 logical resolution. */
(() => {
"use strict";

const W = 960, H = 540, TILE = 32;
const GRAV = 2200, JUMP_V = -690, MOVE = 272, ACCEL = 2600, FRIC = 2400, MAXFALL = 980;

/* SHIFT — the size ladder. Half, normal, double, one bit apart.
   Shifting spends the same meter the lightning pounce uses, so fitting through a
   vent always costs you the burst you might have wanted later. */
const SZ = {
  small:  { s: 0.5, speed: 1.10, jump: -640, stomp: 0 },
  normal: { s: 1.0, speed: 1.00, jump: -690, stomp: 1 },
  big:    { s: 2.0, speed: 0.75, jump: -600, stomp: 2 },
};
const SZ_ORDER = ["small", "normal", "big"];
const SHIFT_COST = 25;      // charge spent per shift
const SHIFT_TIME = 0.25;    // committed frames, no input
const COYOTE = 0.09, JUMP_BUF = 0.12;
const ART_V = "gemini2";        // bump when assets/cat-atlas.* changes

/* transition beats — timing only, no physics lives here */
const VAC_LUNGE_GAP = 96;       // px before the cushion where the vacuum commits
const VAC_SWALLOW = 0.38;       // s of drag-in before the cushion is gone
const BLAST_HOLD = 0.42;        // s of held white before the boss room swaps in
const BLAST_REVEAL = 0.42;      // s to fade from white back into the new room

/* meadow palette taken from the reference mockup */
/* One palette block. Every draw call reads from here — no colour literals below.
   Values sampled from the running game with PIL (see DESIGN.md). */
const C = {
  // world
  skyTop: "#4F8FBA", skyMid: "#73BED3", skyLow: "#A4DDDB",
  mountFar: "#253A5E", mountMid: "#3C5E8B", mountHi: "#4F8FBA",
  forest: "#25562E", forestDark: "#19332D", forestHi: "#468232",
  grass: "#468232", grassHi: "#75A743", grassDark: "#25562E",
  dirt: "#4D2B32", dirtDark: "#341C27", dirtHi: "#7A4841",
  water: "#3C5E8B", waterDeep: "#253A5E", waterHi: "#73BED3",
  stone: "#AD7757", stoneDark: "#7A4841", roof: "#A53030", roofDark: "#752438",
  // ink + paper
  ink: "#090A14", paper: "#E7D5B3", paperShade: "#D7B594", paperEdge: "#C09473",
  // accents
  gold: "#E8C170", goldWarm: "#DE9E41", goldDeep: "#BE772B", red: "#A53030", redDeep: "#752438",
  mist: "#819796",
  // text
  white: "#EBEDE9", textWarm: "#E7D5B3", textSand: "#D7B594", textDim: "rgba(235,237,233,0.66)",
  // surfaces
  panel: "rgba(16,20,31,0.84)", scrim: "rgba(9,10,20,0.76)",
  // boss
  bossShell: "#394A50", bossShellHi: "#577277", bossRim: "#819796",
  bossBrush: "#4D2B32", bossEye: "#73BED3", bossWake: "#E7D5B3", bossSpark: "#DE9E41",
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
  ",":["00000","00000","00000","00000","00110","00110","01100"],
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

function text(str, x, y, s = 2, color = "#10141F", align = "left") {
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
const rimCanvas = document.createElement("canvas");
rimCanvas.width = 96; rimCanvas.height = 96;
const rimCtx = rimCanvas.getContext("2d");
rimCtx.imageSmoothingEnabled = false;

let fxImg = null, fxMeta = null, fxPivot = null;
fetch("assets/fx/lightning-charge.json").then((r) => r.json()).then((m) => {
  fxMeta = m;
  fxPivot = [115, 121];                 // origin [124,148] minus the 9,27 crop
  const im = new Image();
  im.onload = () => { fxImg = im; };
  im.src = m.image;
}).catch(() => { /* hand-drawn arcs stay as the fallback */ });

const powerIcons = [new Image(), new Image(), new Image()];
powerIcons[0].src = "assets/icons/power0.png";
powerIcons[1].src = "assets/icons/power1.png";
powerIcons[2].src = "assets/icons/power2.png";
let ATLAS = null;
/* The story photo (assets/story/pet.png) is not shipped yet; drawCard falls back
   to a code-drawn night room. Drop the file in and set it here to use it. */
let storyImg = null;

const state = {
  mode: "title", t: 0, level: 0, lives: 3, coins: 0, totalCoins: 0, fish: 0,
  setIndex: 0, shake: 0, flash: 0, muted: false, best: 0,
  hudRects: [], idleT: 0, charge: 0, chargeMax: 100, powerId: 0, emberVfx: 0, ringColor: null, burstT: 0, hitstop: 0, decalT: 0, decalX: 0, decalY: 0,
  card: null, handoff: null,
};

/* ---------------------------------------------------------------- sandbox */
// Open the page with ?dev=1 to get the sandbox tools. Without it the game is unchanged.
// The sandbox deployment exists to be poked at, so the stage-skip panel is on by
// default there; the stable build is a different repo and never matches this host.
/* ---------------------------------------------------------- sensor map */
// Hold TAB: the room's sensor schematic. You see the whole floor at once -
// patrols, the vacuum's cone, what you have and have not collected - but you
// cannot act while looking. Information instead of another camera.
const mapView = { on: false, t: 0, sweep: 0 };

const SANDBOX_BUILD = /\/cat-hero-sandbox\//.test(location.pathname);
const DEV = new URLSearchParams(location.search).has("dev") || SANDBOX_BUILD;
const dev = { timeScale: 1, hitboxes: false, god: false, overlay: true, fps: 60 };
let sbEl = null, sbOpen = null, sbNow = null, sbStages = null;

const keys = Object.create(null);
const queued = { jump: false, bat: false };
let paused = false;
let RAY = null;                 // raycaster room instance (ray.js), created in boot()

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
  thunder: () => { beep(120, 0.22, "sawtooth", 0.14, 60); setTimeout(() => beep(700, 0.1, "square", 0.10, 180), 40); },
  bossDie: () => { [300, 240, 180, 120, 70].forEach((f, i) => setTimeout(() => beep(f, 0.22, "sawtooth", 0.11, f * 0.5), i * 130)); },
  lunge: () => beep(120, 0.24, "sawtooth", 0.11, 460),
  gulp: () => { beep(340, 0.26, "sawtooth", 0.11, 60); setTimeout(() => beep(70, 0.20, "triangle", 0.09), 150); },
  meow: () => { beep(660, 0.10, "triangle", 0.08, 920); setTimeout(() => beep(920, 0.16, "triangle", 0.07, 520), 95); },
};

/* ----------------------------------------------------------------- input */
const MAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump",
  ArrowDown: "down", KeyS: "down",
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
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyC") {
    if (state.mode === "play") e.preventDefault();   // Shift+arrows must not select text
    if (!e.repeat) beginShiftKey();
  }
  if (DEV && e.code === "KeyV") { beep(520, 0.06, "square", 0.07); }
  if (e.code === "KeyM") toggleMute();
  if (e.code === "KeyP" || e.code === "Escape") { if (state.mode === "play") paused = !paused; }
  if (DEV) {
    if (e.code === "KeyH") dev.hitboxes = !dev.hitboxes;
    if (e.code === "KeyG") dev.god = !dev.god;
    if (e.code === "Backquote") { dev.overlay = !dev.overlay; toggleSandboxPanel(); }
    if (e.code === "BracketLeft") dev.timeScale = Math.max(0.1, +(dev.timeScale - 0.1).toFixed(2));
    if (e.code === "BracketRight") dev.timeScale = Math.min(3, +(dev.timeScale + 0.1).toFixed(2));
    if (e.code === "KeyN" && state.mode === "play") {
      world.enemies.push({ x: player.x + 120, y: player.y, w: 40, h: 28,
        min: player.x - 400, max: player.x + 400, vx: 70, dir: 1, alive: true, t: 0, squash: 0 });
    }
    if (e.code === "KeyK" && state.mode === "play") for (const en of world.enemies) en.alive = false;
    if (e.code === "KeyT" && state.mode === "play" && world.goal) { player.x = world.goal.x - 60; player.y = world.goal.y - 80; }
    if (e.code === "KeyL" && state.mode === "play") jumpToStage(Math.min(state.level, DEMO_COUNT - 1) + 1);
    if (e.code === "KeyR") restartStage();
    if (e.code === "KeyF") state.charge = state.chargeMax;
    if (e.code === "Digit1") state.powerId = 0;
    if (e.code === "Tab") { e.preventDefault(); setMap(true); }
  if (e.code === "KeyQ") shiftSize(-1);
    if (e.code === "KeyE") shiftSize(1);
  }
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
    if (state.mode === "select" && !e.repeat) {
      state.setIndex = 1 - state.setIndex;
      beep(660, 0.05, "square", 0.06);
    }
  }
});
addEventListener("keyup", (e) => {
  if (e.code === "Tab") { e.preventDefault(); setMap(false); return; }
  const k = MAP[e.code]; if (k) keys[k] = false;
  if (e.code === "Enter" || e.code === "Space") keys.confirm = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyC") endShiftKey();
});

/* Losing focus mid-charge must cancel it without casting — otherwise the cat
   casts when the player tabs back in, or is stuck crouched forever. */
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  player.charging = false; shiftHeld = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.charging = false;
});

document.querySelectorAll("#touch button").forEach((b) => {
  const k = b.dataset.k;
  const on = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (k === "charge") { startCharge(); return; }
    keys[k] = true;
    if (k === "jump") queued.jump = true;
    if (k === "bat") queued.bat = true;
  };
  const off = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (k === "charge") { releaseCharge(); return; }
    keys[k] = false;
  };
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

const LEVELS_ALL = [
  {
    world: "2-1", name: "BACKYARD",
    power: 0,
    width: 1500,
    spawn: { x: 80, y: 380 },
    solids: [
      rect(0, 470, 900, 90), rect(980, 470, 520, 90),
      rect(420, 380, 180, 26), rect(640, 300, 140, 26), rect(1100, 370, 190, 26),
      rect(1340, 290, 150, 26),
    ],
    coins: [
      ...arc(300, 400, 5), ...arc(700, 404, 5),
      ...line(440, 336, 4), ...line(660, 256, 3), ...line(1120, 326, 4),
      ...line(1360, 246, 3),
    ],
    enemies: [
      { x: 620, min: 520, max: 860 },
    ],
    goal: { x: 1400, y: 470 },
    decor: [
      { t: "sign", x: 132 }, { t: "tree", x: 250 }, { t: "bush", x: 360 },
      { t: "tree", x: 700 }, { t: "bush", x: 840 }, { t: "tree", x: 1150 },
      { t: "vacuum_bg", x: 1050 },
    ],
  },
  {
    world: "1-2", name: "THE OLD ORCHARD",
    power: 0,
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
    power: 0,
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
    power: 0,
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
    world: "2-2", name: "THE CLIMB",
    power: 0,
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
    power: 0,
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
    world: "2-5", name: "THE DEN",
    power: 2,
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
  {
    world: "DEV", name: "SANDBOX",
    power: 0,
    width: 2560,
    spawn: { x: 620, y: 380 },
    sandbox: true,
    grid: true,
    solids: [
      rect(0, 470, 2560, 90),
      // SHIFT demo: a 40 px crawl. Normal (42) and big (84) are stopped; half (21) clears.
      rect(880, 0, 220, 430),
      // and a shelf the normal cat can jump onto but the half cat cannot reach
      rect(1320, 356, 200, 24),
      // DUST BARRIER — 170 px tall, so no jump clears it. Double up and pounce.
      Object.assign(rect(1620, 300, 40, 170), { brk: true }),
      Object.assign(rect(2100, 300, 40, 170), { brk: true }),
    ],
    coins: [],
    enemies: [],
    goal: null,
    decor: [],
  },
];

/* The demo is five stages. The old 1-x rooms stay playable in code but are out
   of the progression — they are the post-jam extended mode. */
const LEVELS_EXTRA = LEVELS_ALL.filter((L) => ["1-2", "1-3", "1-4", "1-6"].includes(L.world));

const LEVELS = [
  LEVELS_ALL.find((L) => L.world === "2-1"),
  // THE CLIMB is the Old Mill room: two of its three platforms are vertical
  // lifts, so the route is an actual climb, with one horizontal traverse in
  // the middle to break the rhythm.
  LEVELS_ALL.find((L) => L.world === "2-2"),
  {
    world: "2-3", name: "DUST BIN", ray: true, dark: true, theme: "bin",
    hint: "Hold SHIFT to light the way", chargeRate: 95,
    grid: ["########", "#S..d..#", "#.##.#.#", "#..T.#T#", "##.#...#", "#..d.#.#", "#T##...D", "########"],
  },
  {
    world: "2-4", name: "THE MOTOR", ray: true, dark: false, theme: "motor",
    hint: "Full charge at the core", chargeRate: 95,
    grid: ["#######", "#S.B..#", "#.#.#.#", "#..M..#", "#.#.#.#", "#..B.E#", "#######"],
  },
  LEVELS_ALL.find((L) => L.world === "2-5"),
  LEVELS_ALL.find((L) => L.sandbox),
];
const DEMO_COUNT = 5;

/* ---------------------------------------------------------------- player */
const player = {
  x: 0, y: 0, w: 34, h: 42, vx: 0, vy: 0, facing: 1,
  onGround: false, coyote: 0, buf: 0, anim: "idle", animT: 0, frame: 0,
  attack: 0, cooldown: 0, invuln: 0, dead: false, spawnX: 0, spawnY: 0, ride: null, wake: 0, power: 0, powerHits: 0, chargeT: 0, charging: false, react: 0,
  size: "normal", sc: 1, shiftT: 0,
};

function loadLevel(i, opts = {}) {
  const L = LEVELS[i];
  if (RAY) RAY.exit();
  if (L.ray) {                         // raycaster room: ray.js owns the world
    world.level = L; world.boss = null; world.enemies = []; world.coins = []; world.plats = [];
    world.goal = null; world.goalDef = null; world.vac = null;
    world.particles.length = 0; world.total = 0; state.totalCoins = 0; state.coins = 0;
    RAY.enter(L);
    paused = false;
    state.mode = "play";
    document.body.classList.add("playing");
    document.body.classList.add("ray");
    return;
  }
  document.body.classList.remove("ray");
  player.x = L.spawn.x; player.y = L.spawn.y;
  player.spawnX = L.spawn.x; player.spawnY = L.spawn.y;
  player.vx = player.vy = 0; player.facing = 1; player.dead = false;
  player.invuln = 0; player.attack = 0; player.cooldown = 0;
  player.anim = "idle"; player.animT = 0; player.frame = 0;
  world.level = L;
  world.coins = L.coins.map((c) => ({ x: c.x, y: c.y, got: false, t: Math.random() * 6 }));
  world.enemies = L.enemies.map((e) => ({
    x: e.x, y: 0, w: 40, h: 28, min: e.min, max: e.max,
    vx: 70, dir: 1, alive: true, t: Math.random() * 3, squash: 0, frozen: 0,
  }));
  world.goalDef = L.goal || null;
  // In the boss room (and the sandbox) there is no cushion until something creates one.
  world.goal = (L.boss || !L.goal) ? null : { x: L.goal.x, y: L.goal.y, t: 0 };
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
  state.powerId = 0;
  player.size = "normal"; player.sc = 1; player.shiftT = 0;
  player.w = 34; player.h = 42;
  state.idleT = 0;
  for (const q of L.solids) q.broken = false;   // dust barriers come back on reload
  const vd = (L.decor || []).find((d) => d.t === "vacuum_bg");
  world.vac = vd ? { trigger: vd.x, toyX: vd.x + 220, toyEaten: false,
                     started: false, phase: "idle", phaseT: 0, done: false, t: 0, x: 0 } : null;
  player.react = 0;
  paused = false;
  state.mode = "play";
  document.body.classList.add("playing");
  if (opts.introBlast && world.boss) {          // free first stomp after a ray-room blast
    player.x = 200; player.y = 120; player.vy = -300;
    world.boss.state = "stun"; world.boss.stun = 3.0; world.boss.t = 0;
    state.shake = 10;
    if (!opts.holdFlash) state.flash = 1;       // a handoff owns the white; never flash twice
  }
}

const world = {
  level: null, coins: [], enemies: [], particles: [], cam: 0, got: 0, total: 0,
  goal: null, time: 0, checkpoint: 0, plats: [], boss: null, goalDef: null, vac: null,
};
/* ------------------------------------------------------- sandbox panel */
function resetStageState() {
  state.lives = 3; state.checkpoint = 0; state.fish = 0; state.coins = 0;
  state.card = null; player.charging = false; state.charge = 0; paused = false;
  document.body.classList.add("playing");
}

function jumpToStage(i) {
  const target = Math.max(0, Math.min(DEMO_COUNT - 1, i | 0));
  resetStageState();
  state.level = target;
  loadLevel(target);
  syncSandbox();
}

/* DEV: park the player on the exact frame a transition starts, so the swallow
   and the motor blast can be watched (and tuned) without playing up to them. */
function gotoBeat(kind) {
  if (kind === "swallow") {
    const i = LEVELS.findIndex((L) => (L.decor || []).some((d) => d.t === "vacuum_bg"));
    if (i < 0) return false;
    jumpToStage(i);
    const v = world.vac, L = LEVELS[i];
    if (!v) return false;
    player.x = Math.max(24, v.trigger - 190);
    player.y = L.spawn.y;
    player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
    // this beat is about watching the swallow, not surviving the walk there
    for (const e of world.enemies) e.alive = false;
    player.invuln = 2.5;
    world.cam = Math.max(0, Math.min(player.x - W * 0.36, L.width - W));
    return true;
  }
  if (kind === "blast") {
    const i = LEVELS.findIndex((L) => L.ray && L.theme === "motor");
    if (i < 0) return false;
    jumpToStage(i);
    const R = RAY && RAY.state;
    if (!R || !R.motor) return false;
    // stand 1.2 tiles off the core, already facing it, charge loaded
    const ang = Math.atan2(R.motor.y - R.y, R.motor.x - R.x);
    RAY.debugTeleport(R.motor.x - Math.cos(ang) * 1.2, R.motor.y - Math.sin(ang) * 1.2,
                      Math.cos(ang), Math.sin(ang));
    state.charge = state.chargeMax;
    // fire it too: one tap on a phone should play the beat, not load the gun
    RAY.release();
    return true;
  }
  return false;
}

function restartStage() {
  resetStageState();
  loadLevel(Math.min(state.level, LEVELS.length - 1));
  syncSandbox();
}

function syncSandbox() {
  if (!sbNow) return;
  const L = LEVELS[state.level];
  sbNow.textContent = L ? `${L.world} · ${L.name}` : "DEV";
  for (const b of sbStages.querySelectorAll("button"))
    b.classList.toggle("active", +b.dataset.stage === state.level);
}

function toggleSandboxPanel(force) {
  if (!sbEl) return;
  const show = force === undefined ? sbEl.hidden : force;
  sbEl.hidden = !show;
  if (sbOpen) sbOpen.hidden = show;
  if (show) syncSandbox();
}

function initSandboxUI() {
  if (!DEV) return;
  sbEl = document.getElementById("sandbox");
  sbOpen = document.getElementById("sb-open");
  sbNow = document.getElementById("sb-now");
  sbStages = document.getElementById("sb-stages");
  if (!sbEl || !sbStages) return;

  for (let i = 0; i < DEMO_COUNT; i++) {
    const L = LEVELS[i], b = document.createElement("button");
    b.dataset.stage = i;
    b.textContent = `${L.world} ${L.name}`;
    b.addEventListener("click", () => { jumpToStage(i); b.blur(); });
    sbStages.appendChild(b);
  }
  const closeBtn = document.getElementById("sb-close");
  closeBtn.addEventListener("click", () => { toggleSandboxPanel(false); closeBtn.blur(); });
  sbOpen.addEventListener("click", () => { toggleSandboxPanel(true); sbOpen.blur(); });
  for (const b of sbEl.querySelectorAll("[data-sb]")) {
    b.addEventListener("click", () => {
      const act = b.dataset.sb;
      if (act === "beat-swallow") gotoBeat("swallow");
      else if (act === "beat-blast") gotoBeat("blast");
      else if (act === "restart") restartStage();
      else if (act === "prev") jumpToStage(Math.min(state.level, DEMO_COUNT - 1) - 1);
      else jumpToStage(Math.min(state.level, DEMO_COUNT - 1) + 1);
      b.blur();                         // Space must stay a jump, not a button press
    });
  }
  sbEl.hidden = false;
  sbOpen.hidden = true;
  syncSandbox();
}



/* ------------------------------------------------------------- collision */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidHit(box) {
  for (const s of world.level.solids) if (!s.broken && overlaps(box, s)) return s;
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

/* ------------------------------------------------------------- shifting */
/* SHIFT cycles half -> normal -> double -> half. One key, one thumb. */
function cycleSize() {
  const order = ["small", "normal", "big"];
  const i = order.indexOf(player.size);
  return setSize(order[(i + 1) % order.length]);
}

function shiftSize(dir) {
  const i = SZ_ORDER.indexOf(player.size);
  const next = SZ_ORDER[Math.max(0, Math.min(SZ_ORDER.length - 1, i + dir))];
  if (next === player.size) return false;
  return setSize(next);
}

function setSize(name) {
  const p = player, spec = SZ[name];
  if (!spec || p.size === name || p.dead) return false;
  if (state.charge < SHIFT_COST) { beep(150, 0.05, "square", 0.04); return false; }
  const w = Math.round(34 * spec.s), h = Math.round(42 * spec.s);
  const nx = p.x + (p.w - w) / 2, ny = p.y + p.h - h;
  // growing needs headroom; shrinking is always legal, so you can never be trapped
  if (spec.s > 1 && solidHit(rect(nx, ny, w, h))) {
    beep(140, 0.07, "square", 0.05, 90);
    dust(p.x + p.w / 2, p.y + p.h, 3);
    return false;
  }
  state.charge -= SHIFT_COST;
  p.size = name; p.w = w; p.h = h; p.x = nx; p.y = ny;
  p.shiftT = SHIFT_TIME;
  p.vx *= spec.speed;
  beep(spec.s > 1 ? 300 : 520, 0.06, "square", 0.06);
  dust(p.x + p.w / 2, p.y + p.h, spec.s > 1 ? 8 : 4);
  return true;
}

/* Every respawn is a fresh cat: a 2x body carried through a death could spawn
   inside geometry it no longer fits in. */
function resetSize() {
  const p = player;
  if (p.size === "normal") { p.sc = 1; return; }
  const feet = p.y + p.h;
  p.size = "normal"; p.sc = 1; p.w = 34; p.h = 42;
  p.y = feet - p.h;
  p.shiftT = 0;
}

function hurt(fell) {
  const p = player;
  if (p.dead || p.invuln > 0) return;
  cancelVacuum();                 // a death cancels the swallow beat; so does loadLevel
  p.react = 0;
  state.lives--;
  state.shake = 12;
  sfx.hit();
  burst(p.x + p.w / 2, p.y + p.h / 2, 14, "#CF573C");
  if (state.lives <= 0) {
    p.dead = true; state.mode = "gameover"; state.best = Math.max(state.best, state.coins);
    setTimeout(() => { }, 0);
    return;
  }
  p.invuln = 1.4;
  if (fell) { resetSize(); p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; }
  else { p.vx = -p.facing * 240; p.vy = -320; }
  // Boss room: every hit is a clean retry — back to the door, boss at full health.
  if (world.boss && !world.boss.dead) {
    resetSize();
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
      vy: -20 - Math.random() * 40, life: 0.35, max: 0.35, c: "#C09473", s: 3 });
  }
}

/* ------------------------------------------------------------------ turn */
function update(dt) {
  if (mapView.on) {                 // looking is not acting
    keys.left = keys.right = keys.jump = keys.bat = false;
    queued.jump = false; queued.bat = false;
    state.charge = Math.max(0, state.charge - 16 * dt);   // peeking burns the meter
  }
  state.t += dt;
  if (state.hitstop > 0) { state.hitstop -= dt; updateParticles(dt); return; }
  if (state.mode === "card" && state.card) { state.card.t += dt; return; }
  if (state.mode !== "play" || paused) { updateParticles(dt); return; }
  if (state.handoff) { updateHandoff(dt); updateParticles(dt); return; }
  if (world.level && world.level.ray && state.mode === "play") { RAY.update(dt); return; }

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
  if ((want !== 0 || queued.jump) && state.idleT > 6) { state.idleT = 0; }
  if (want !== 0) {
    p.vx += want * ACCEL * dt;
    p.facing = want;
    const mv = MOVE * SZ[p.size].speed;
    p.vx = Math.max(-mv, Math.min(mv, p.vx));
  } else {
    const s = Math.sign(p.vx);
    p.vx -= s * FRIC * dt;
    if (Math.sign(p.vx) !== s) p.vx = 0;
  }

  // size: ease the art toward the body, count down the committed shift
  p.sc += (SZ[p.size].s - p.sc) * Math.min(1, dt * 16);
  p.shiftT = Math.max(0, p.shiftT - dt);

  // jump
  p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
  if (queued.jump) { p.buf = JUMP_BUF; queued.jump = false; }
  p.buf = Math.max(0, p.buf - dt);
  if (p.buf > 0 && p.coyote > 0) {
    p.vy = SZ[p.size].jump; p.buf = 0; p.coyote = 0; p.onGround = false;
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

  updatePower(dt);
  p.vy = Math.min(MAXFALL, p.vy + GRAV * dt);
  movePlayer(dt);
  if (p.invuln > 0) p.invuln -= dt;
  if (DEV && dev.god) p.invuln = Math.max(p.invuln, 0.4);

  // animation
  p.animT += dt;
  const speed = Math.abs(p.vx);
  p.wake = Math.max(0, p.wake - dt);
  p.react = Math.max(0, p.react - dt);
  state.emberVfx = Math.max(0, state.emberVfx - dt);
  state.burstT = Math.max(0, state.burstT - dt);
  state.decalT = Math.max(0, state.decalT - dt);
  updateOrbit(dt);
  p.chargeT = Math.max(0, p.chargeT - dt);
  if (p.charging && !p.dead) {
    if (Math.abs(p.vx) > 24 || !p.onGround) {   // moving cancels the crouch
      p.charging = false;
    } else {
      const lv = state.charge / state.chargeMax;
      if (lv > 0.6) state.shake = Math.max(state.shake, 1 + 1.5 * lv);   // 2px rumble
      state.charge = Math.min(state.chargeMax, state.charge + 95 * dt);
      p.chargeT = 0.05;               // keeps the crouch alive for the whole hold
    }
  }

  // stand still long enough and the cat lies down, then falls asleep
  if (p.onGround && speed < 20 && p.attack <= 0 && p.wake <= 0 && !p.dead) state.idleT += dt;
  else if (speed >= 20 || !p.onGround) state.idleT = 0;

  let anim = "idle";
  if (p.power > 0) anim = "bat";
  else if (p.charging || p.chargeT > 0) anim = "charge";
  else if (p.attack > 0) anim = "bat";
  else if (!p.onGround) anim = "jump";
  else if (speed > (p.anim === "run" ? 170 : 210)) anim = "run";
  else if (speed > 20) anim = "walk";
  else if (state.idleT > 14) anim = "sleep";
  else if (state.idleT > 6) anim = "rest";
  if (anim !== p.anim) { p.anim = anim; p.animT = 0; }
  const fps = anim === "run" ? 15 : anim === "walk" ? 11 : anim === "bat" ? 16 : 6;
  const frames = ATLAS[state.setIndex === 0 ? "black" : "grey"][anim];
  if (anim === "jump") {
    const n = frames.length;
    p.frame = p.vy < -250 ? 0 : p.vy < 0 ? Math.min(1, n - 1) : p.vy > 300 ? n - 1 : Math.max(1, n - 2);
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
    if (e.frozen > 0) { e.frozen -= dt; e.t += dt; continue; }
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
      addCharge(7);
      sfx.coin();
      burst(c.x, c.y, 8, C.goldWarm);
    }
  }

  // checkpoint
  if (p.x > state.checkpoint + 200) state.checkpoint = p.x;

  // goal
  if (world.goal && overlaps(rect(p.x, p.y, p.w, p.h), rect(world.goal.x - 66, world.goal.y - 92, 132, 92))) {
    state.mode = "clear"; sfx.win(); state.shake = 6;
    burst(world.goal.x, world.goal.y - 40, 30, C.goldWarm);
  }

  updateVacuum(dt);

  // camera
  const target = Math.max(0, Math.min(p.x + p.w / 2 - W * 0.42, world.level.width - W));
  world.cam += (target - world.cam) * Math.min(1, dt * 8);

  updateParticles(dt);
  state.shake = Math.max(0, state.shake - dt * 40);
}

/* --------------------------------------------------------- charge layers */
// Sparks circle the cat on a flattened ellipse. sin(angle) gives depth: negative is
// behind the sprite, positive in front — that switch is what sells the volume.
const orbit = Array.from({ length: 5 }, (_, i) => ({
  a: (i / 5) * Math.PI * 2,
  speed: 2.2 + i * 0.55,
  r: 26 + (i % 3) * 9,
  tilt: 0.28 + (i % 2) * 0.10,
  size: 1 + (i % 2),
}));

function chargeLevel() { return state.charge / state.chargeMax; }

function updateOrbit(dt) {
  if (!player.charging && state.burstT <= 0) return;
  for (const o of orbit) o.a += o.speed * dt;
}

/* --------------------------------------------------------------- powers */
function startCharge() {
  if (state.mode !== "play" || player.dead) return;
  player.charging = true;
}

/* SHIFT is both buttons. A flick shifts the body, a hold charges the pounce.
   Tracked here rather than on player.charging, because the crouch is cancelled
   the moment the cat is moving - a tap while running must still count. */
let shiftHeld = false, shiftAt = 0, shiftCharge0 = 0;

function beginShiftKey() {
  shiftHeld = true; shiftAt = state.t; shiftCharge0 = state.charge;
  startCharge();
}

function endShiftKey() {
  if (!shiftHeld) return;
  shiftHeld = false;
  const tapped = (state.t - shiftAt) < 0.18
    && state.charge < state.chargeMax
    && state.charge - shiftCharge0 < 12;
  if (tapped) { player.charging = false; cycleSize(); return; }
  releaseCharge();
}

function releaseCharge() {
  if (!player.charging) return;
  player.charging = false;
  if (world.level && world.level.ray) { if (RAY) RAY.release(); return; }
  if (state.charge >= state.chargeMax) { tryPower(); return; }   // release at full = cast
  if (state.charge > 20) {                                       // fizzle: keep the banked meter
    beep(180, 0.08, "triangle", 0.07, 120);
    burst(player.x + player.w / 2, player.y + player.h / 2, 6, C.mist);
  }
}

function addCharge(n) {
  const before = state.charge;
  state.charge = Math.min(state.chargeMax, state.charge + n);
  if (before < state.chargeMax && state.charge >= state.chargeMax) {
    sfx.charge();
    burst(player.x + player.w / 2, player.y + player.h / 2, 16, C.goldWarm);
  }
}

/* One power. The other two were never chosen in play — they were picked by the
   level you happened to be on — so they were noise in the HUD and in the jam build. */
const POWERS = [
  { name: "THUNDER POUNCE", tint: "#73BED3" },
];

function castThunder() {
  const p = player;
  p.power = 0.42;
  p.powerHits = 0;
  p.invuln = Math.max(p.invuln, 0.5);
  state.shake = 8;
  state.hitstop = 0.05;
  state.flash = 0.9;
  if (fxMeta) state.burstT = (fxMeta.frames - fxMeta.burstStart) / fxMeta.fps;
  sfx.thunder();
}

function tryPower() {
  const p = player;
  if (state.charge < state.chargeMax || p.power > 0 || p.dead) return false;
  state.charge = 0;
  castThunder();
  p.invuln = Math.max(p.invuln, 0.4);
  return true;
}

const powerTrail = [];

function updatePower(dt) {
  const p = player;
  if (p.power <= 0) return;
  powerTrail.push({ x: p.x, y: p.y, f: p.facing, life: 0.22, max: 0.22 });
  if (powerTrail.length > 12) powerTrail.shift();
  for (let i = powerTrail.length - 1; i >= 0; i--) {
    powerTrail[i].life -= dt;
    if (powerTrail[i].life <= 0) powerTrail.splice(i, 1);
  }
  p.power -= dt;
  // lunge in the facing direction, ignoring friction while it lasts
  p.vx = p.facing * 760;
  p.vy = Math.min(p.vy, 0) * 0.2;
  // anything the cat passes through dies
  const hb = rect(p.x - 14, p.y - 10, p.w + 28, p.h + 20);
  for (const e of world.enemies) {
    if (e.alive && overlaps(hb, rect(e.x, e.y, e.w, e.h))) { killEnemy(e, p.facing * 260); p.powerHits++; }
  }
  // a double-size pounce goes through a dust barrier; anything smaller bounces off it
  if (p.size === "big") {
    for (const sd of world.level.solids) {
      if (!sd.brk || sd.broken || !overlaps(hb, sd)) continue;
      sd.broken = true;
      state.shake = 10; state.hitstop = 0.04;
      sfx.land && sfx.land();
      burst(sd.x + sd.w / 2, sd.y + sd.h / 2, 26, C.mist);
    }
  }

  if (world.boss && !world.boss.dead && overlaps(hb, rect(world.boss.x, world.boss.y, world.boss.w, world.boss.h))) {
    if (world.boss.state === "stun" && world.boss.invuln <= 0) {
      world.boss.hp--; world.boss.flash = 0.45; world.boss.invuln = 0.7;
      world.boss.state = "hurt"; world.boss.t = 0; world.boss.vx = -world.boss.dir * 280;
      state.shake = 12; sfx.bossHit();
      if (world.boss.hp <= 0) killBoss();
    }
  }
  if (Math.random() < 0.6) {
    const a = (Math.random() - 0.5) * 2.2;
    world.particles.push({ x: p.x + p.w / 2, y: p.y + p.h / 2,
      vx: Math.cos(a) * 260 - p.facing * 120, vy: Math.sin(a) * 260,
      life: 0.22, max: 0.22, c: C.bossEye, s: 3 });
  }
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
  burst(b.x + b.w / 2, b.y + b.h / 2, 40, "#AD7757");
  burst(b.x + b.w / 2, b.y + b.h / 2, 24, C.bossSpark);
}

/* The vacuum swallow is one readable beat, not a pop:
   idle -> (trigger) -> lunging at the cushion -> dragging it in -> eaten.
   Every timer lives on world.vac, so a level reload rebuilds the beat from
   scratch and hurt() cancels it — nothing leaks across rooms. */
function cancelVacuum() {
  const v = world.vac;
  if (!v || v.done || !v.started) return;
  v.started = false; v.phase = "idle"; v.phaseT = 0; v.t = 0; v.x = 0; v.toyEaten = false;
}

function vacuumCushion(v) {
  if (v.phase !== "swallowing") return { x: v.toyX, y: 456, s: 1, k: 0 };
  const k = Math.min(1, v.phaseT / VAC_SWALLOW);
  // the vacuum lunges and brakes first; the cushion only starts moving once
  // the intake is nearly on it, then shrinks into the mouth
  const dk = Math.max(0, Math.min(1, (k - 0.35) / 0.65));
  const e = dk * dk * (3 - 2 * dk);
  return {
    x: v.toyX + (v.x + 52 - v.toyX) * e,     // into the intake slot at the shell's centre
    y: 456 + (440 - 456) * e,
    s: 1 - 0.82 * e,
    k,
  };
}

function updateVacuum(dt) {
  const v = world.vac;
  if (!v || v.done) return;
  if (!v.started) {
    if (player.x > v.trigger) {
      v.started = true; v.phase = "idle"; v.phaseT = 0; v.t = 0;
      v.x = world.cam + W + 140;
    }
    return;
  }
  v.t += dt;

  if (v.phase === "idle") {
    v.x -= 500 * dt;
    if (v.x < v.toyX + VAC_LUNGE_GAP) {     // it has seen the cushion: commit
      v.phase = "swallowing"; v.phaseT = 0;
      v.lungeFrom = v.x; v.lungeTo = v.toyX - 40;   // intake stops over the cushion
      state.shake = Math.max(state.shake, 4);
      sfx.lunge();
    }
    return;
  }

  if (v.phase === "swallowing") {
    v.phaseT += dt;
    const k = Math.min(1, v.phaseT / VAC_SWALLOW);
    const e = 1 - Math.pow(1 - k, 3);       // lunge, then brake onto the cushion
    v.x = v.lungeFrom + (v.lungeTo - v.lungeFrom) * e;
    if (k >= 1) {
      v.phase = "eaten"; v.phaseT = 0;
      v.toyEaten = true;
      state.flash = 0.7; state.shake = 12;
      player.react = 0.6;                   // the cat startles, sprite only
      burst(v.toyX, 452, 18, C.goldWarm);
      sfx.gulp();
      // the meow is queued, so a reload/death in the next 130 ms must not leak it
      setTimeout(() => {
        const nv = world.vac;
        if (nv && nv.toyEaten && nv.phase === "eaten") sfx.meow();
      }, 130);
    }
    return;
  }

  // eaten: the vac keeps rolling out of frame, then is gone for the rest of the level
  v.x -= 520 * dt;
  if (v.t >= 3) v.done = true;
}

function updateBoss(dt) {
  const b = world.boss;
  if (!b) return;
  const p = player;

  if (b.dead) {
    b.deadT += dt;
    if (b.deadT > 0.9 && !world.goal) {
      world.goal = { x: world.goalDef.x, y: world.goalDef.y, t: 0 };
      burst(world.goalDef.x, world.goalDef.y - 50, 26, C.goldWarm);
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
        burst(b.x + b.w / 2, b.y + 10, 18, C.bossSpark);
        if (b.hp <= 0) killBoss();
      } else {
        p.vy = -440; p.invuln = 0.25; sfx.clank();
        burst(p.x + p.w / 2, p.y + p.h, 6, "#AD7757");
      }
    } else {
      hurt(false);
    }
  }
}

function killEnemy(e, knock) {
  e.alive = false; e.squash = 0.25;
  addCharge(28);
  burst(e.x + e.w / 2, e.y + e.h / 2, 12, "#AD7757");
  if (knock) { /* no body physics, just particles */ }
}

function updateParticles(dt) {
  if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
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
  ctx.fillStyle = C.white;
  ctx.fillRect(x, y + 10 * s, 52 * s, 12 * s);
  ctx.fillRect(x + 8 * s, y + 3 * s, 34 * s, 9 * s);
  ctx.fillRect(x + 18 * s, y - 4 * s, 18 * s, 8 * s);
  ctx.fillStyle = "#EBEDE9";
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
  ctx.fillStyle = "#E7D5B3";
  for (let i = 0; i < 20; i++) {
    const x = ((i * 120 - cam * 0.7) % 2400 + 2400) % 2400 - 100;
    ctx.fillRect(Math.round(x), top - 2, 26, 3);
  }
}

function drawTree(x, groundY, s = 1) {
  const h = 96 * s;
  ctx.fillStyle = "#7A4841";
  ctx.fillRect(x - 7 * s, groundY - h * 0.52, 14 * s, h * 0.52);
  ctx.fillStyle = "#4D2B32";
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
  ctx.fillStyle = "#7A4841";
  ctx.fillRect(x - 3, groundY - 46, 7, 46);
  ctx.fillStyle = "#AD7757";
  ctx.fillRect(x - 30, groundY - 66, 64, 26);
  ctx.fillStyle = "#4D2B32";
  ctx.fillRect(x - 30, groundY - 66, 64, 3);
  text("GO!", x + 2, groundY - 60, 2, "#E8C170", "center");
  ctx.fillStyle = "#E8C170";
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
    if (s.broken) continue;
    if (s.x + s.w < cam - 40 || s.x > cam + W + 40) continue;
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    if (s.brk) {                       // dust barrier: reads as loose, not solid
      ctx.fillStyle = C.mist;
      ctx.fillRect(x, y, s.w, s.h);
      ctx.fillStyle = C.paperEdge;
      for (let py = 6; py < s.h; py += 14) {
        for (let px = 4; px < s.w - 4; px += 11) {
          if ((px * 3 + py * 7) % 5 < 3) ctx.fillRect(x + px, y + py, 5, 3);
        }
      }
      ctx.fillStyle = C.ink;
      ctx.fillRect(x, y, 2, s.h);
      ctx.fillRect(x + s.w - 2, y, 2, s.h);
      continue;
    }
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

    ctx.fillStyle = "#7A4841";
    ctx.fillRect(x, y, q.w, q.h);
    ctx.fillStyle = "#602C2C";
    ctx.fillRect(x, y + q.h - 5, q.w, 5);
    ctx.fillStyle = C.bossSpark;
    ctx.fillRect(x, y, q.w, 4);

    ctx.fillStyle = "#341C27";
    for (let px = 8; px < q.w - 6; px += 18) ctx.fillRect(x + px, y + 7, 3, 3);

    ctx.fillStyle = "#AD7757";
    ctx.fillRect(x - 2, y, 4, q.h);
    ctx.fillRect(x + q.w - 2, y, 4, q.h);
  }
}

function drawCoin(c) {
  const bob = Math.sin(c.t * 4) * 3;
  const x = Math.round(c.x - world.cam);
  const y = Math.round(c.y + bob);
  // little fish: body, tail, fin, eye
  ctx.fillStyle = "#A53030";
  ctx.fillRect(x - 10, y - 5, 18, 10);
  ctx.fillRect(x - 15, y - 8, 6, 7);
  ctx.fillRect(x - 15, y + 1, 6, 7);
  ctx.fillStyle = C.red;
  ctx.fillRect(x - 9, y - 6, 17, 9);
  ctx.fillStyle = "#DF84A5";
  ctx.fillRect(x - 7, y - 4, 12, 3);
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + 1, y - 4, 3, 3);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + 2, y - 3, 2, 2);
  ctx.fillStyle = "#A53030";
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
      ctx.fillStyle = "#7A4841";
      ctx.fillRect(x + 4, y + e.h - 8, e.w - 8, 8);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x + 8, y + e.h - 5, 6, 3);
    }
    return;
  }
  if (e.frozen > 0) {
    ctx.fillStyle = "rgba(164,221,219,0.55)";
    ctx.fillRect(x - 2, y - 2, e.w + 4, e.h + 4);
    ctx.strokeStyle = C.bossEye; ctx.lineWidth = 1;
    ctx.strokeRect(x - 2, y - 2, e.w + 4, e.h + 4);
  }
  const wob = Math.sin(e.t * 8) * 1.5;
  // bird body
  ctx.fillStyle = "#A53030";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h * 0.55, 17, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#A53030";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2, y + e.h * 0.5, 15, 11, 0, 0, 7); ctx.fill();
  // belly
  ctx.fillStyle = "#E7D5B3";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2 + 2, y + e.h * 0.66, 9, 6, 0, 0, 7); ctx.fill();
  // head
  ctx.fillStyle = "#A53030";
  ctx.beginPath(); ctx.arc(x + e.w / 2 + 8, y + e.h * 0.34 + wob, 8, 0, 7); ctx.fill();
  // beak
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + e.w / 2 + 15, y + e.h * 0.33 + wob, 7, 4);
  ctx.fillStyle = "#DE9E41";
  ctx.fillRect(x + e.w / 2 + 15, y + e.h * 0.38 + wob, 6, 2);
  // eye
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + e.w / 2 + 8, y + e.h * 0.3 + wob, 4, 4);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x + e.w / 2 + 9, y + e.h * 0.31 + wob, 2, 2);
  // wing
  ctx.fillStyle = "#752438";
  ctx.beginPath(); ctx.ellipse(x + e.w / 2 - 5, y + e.h * 0.55, 9, 5, -0.3, 0, 7); ctx.fill();
  // feet
  ctx.fillStyle = "#DE9E41";
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
  ctx.fillStyle = "#341C27";
  ctx.fillRect(x - dw / 2, y - dh, dw, dh);
  ctx.fillStyle = "#4D2B32";
  ctx.fillRect(x - dw / 2 + 3, y - dh + 3, dw - 6, dh - 3);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + dw / 2 - 9, y - dh / 2, 3, 3);

  // paw print on the door
  ctx.fillStyle = "#D7B594";
  ctx.beginPath(); ctx.ellipse(x, y - 26, 6, 5, 0, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-7, -8], [-2, -11], [4, -11], [8, -7]]) {
    ctx.beginPath(); ctx.arc(x + dx, y - 26 + dy, 2.4, 0, 7); ctx.fill();
  }

  // GOAL plaque
  ctx.fillStyle = "#341C27";
  ctx.fillRect(x - 34, y0 + 8, 68, 22);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x - 32, y0 + 10, 64, 18);
  text("GOAL", x, y0 + 14, 2, "#341C27", "center");

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
    text("Z", zx, zy, 1 + Math.floor(p * 2), C.white);
    ctx.globalAlpha = 1;
  }
}

function drawRoomba(b, scale = 1, dim = 0) {
  if (!b) return;
  const x = Math.round(b.x - world.cam), y = Math.round(b.y);
  const cx = x + b.w / 2, cy = y + b.h / 2;
  ctx.save();
  if (scale !== 1) {                       // keep the wheels on the same ground line
    ctx.translate(cx, y + b.h);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(y + b.h));
  }
  if (dim > 0) ctx.filter = `brightness(${(1 - dim).toFixed(2)})`;

  ctx.fillStyle = "rgba(8,18,26,0.25)";
  ctx.beginPath(); ctx.ellipse(cx, y + b.h - 2, b.w * 0.48, 9, 0, 0, 7); ctx.fill();

  if (b.dead) {
    ctx.fillStyle = "#4D2B32";
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, b.w * 0.46, b.h * 0.26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.bossSpark;
    ctx.fillRect(cx - 10, cy + 2, 20, 6);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = "rgba(180,170,150,0.5)";
      ctx.fillRect(cx - 30 + i * 22, cy - 14 - i * 6, 8, 8);
    }
    ctx.restore();
    return;
  }

  // spinning brush skirt
  ctx.strokeStyle = C.bossBrush; ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const a = b.spin + i * (Math.PI / 5);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 22);
    ctx.lineTo(cx + Math.cos(a) * 54, cy + Math.sin(a) * 33);
    ctx.stroke();
  }

  // shell
  ctx.fillStyle = b.flash > 0 ? C.bossWake : C.bossShell;
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.46, b.h * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = b.flash > 0 ? "#EBEDE9" : C.bossShellHi;
  ctx.beginPath(); ctx.ellipse(cx, cy - 7, b.w * 0.38, b.h * 0.30, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = C.bossRim; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.46, b.h * 0.42, 0, 0, 7); ctx.stroke();

  // the cushion it swallowed, visible through the intake
  ctx.fillStyle = "#752438";
  ctx.fillRect(cx - 13, cy + 4, 26, 8);
  ctx.fillStyle = "#DE9E41";
  ctx.fillRect(cx - 13, cy + 4, 26, 2);

  // eye
  const angry = b.state === "charge" || b.state === "telegraph";
  const ex = cx + b.dir * 12;
  ctx.fillStyle = angry ? "#A53030" : C.bossEye;
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
  ctx.restore();
}

function drawBoss() { drawRoomba(world.boss); }

function drawBall(wx, wy = 456, s = 1) {
  ctx.save();
  ctx.translate(Math.round(wx - world.cam), Math.round(wy));
  if (s !== 1) ctx.scale(s, s);
  ctx.fillStyle = "rgba(9,10,20,0.25)";
  ctx.beginPath(); ctx.ellipse(0, 12, 13, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.redDeep;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
  ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(-1, -1, 10, 0, 7); ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.fillRect(-10, -2, 20, 4);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(-6, -7, 4, 3);
  ctx.restore();
}

function drawVacuum() {
  const v = world.vac;
  if (!v || !v.started || v.done) return;
  // idle roomba belongs to the background; the beat draws in front of the goal
  // house and the sleeping cat, otherwise the drag is hidden behind them
  const idle = v.phase === "idle";
  drawRoomba({ x: v.x, y: 470 - 72, w: 104, h: 72, dir: -1, spin: state.t * 7,
               state: idle ? "patrol" : "charge",
               dead: false, flash: 0 }, idle ? 0.6 : 0.95, idle ? 0.5 : 0.12);

  // the cushion is drawn over the shell so it visibly sinks into the intake slot
  if (v.toyEaten) return;
  const c = vacuumCushion(v);
  drawBall(c.x, c.y, c.s);
  if (v.phase === "swallowing") {          // suction streaks sell the pull
    const mouthX = v.x + 52 - world.cam, mouthY = 438;
    ctx.strokeStyle = "rgba(235,237,233,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const k = 0.35 + 0.6 * ((v.phaseT * 5 + i * 0.33) % 1);
      const sx = c.x - world.cam + (mouthX - (c.x - world.cam)) * k;
      const sy = c.y + (mouthY - c.y) * k + (i - 1) * 7;
      ctx.beginPath(); ctx.moveTo(Math.round(sx), Math.round(sy));
      ctx.lineTo(Math.round(sx + 9), Math.round(sy)); ctx.stroke();
    }
  }
}

function drawVacuumBg() {                      // ambient pass-by, behind the level
  const v = world.vac;
  if (!v || !v.started || v.done || v.phase !== "idle") return;
  drawVacuum();
}

function drawVacuumFront() {                   // the swallow beat, over decor + goal
  const v = world.vac;
  if (!v || !v.started || v.done || v.phase === "idle") return;
  drawVacuum();
}

function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
  const set = state.setIndex === 0 ? "black" : "grey";
  const frames = ATLAS[set][p.anim] || ATLAS[set].idle;
  const f = frames[Math.min(p.frame, frames.length - 1)];
  let jx = 0, jy = 0;
  if (p.charging) {                       // 1 px shake that grows with the charge
    const lv = chargeLevel();
    if (Math.random() < 0.35 + 0.4 * lv) jx = Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.25 + 0.35 * lv) jy = Math.random() < 0.5 ? -1 : 1;
  }
  if (p.react > 0) {                      // startled after the swallow
    jx += Math.random() < 0.5 ? -1 : 1;
    if (Math.random() < 0.35) jy -= 1;
  }
  const x = Math.round(p.x + p.w / 2 - world.cam) + jx;
  const y = Math.round(p.y + p.h) + jy;
  ctx.save();
  ctx.translate(x, y);
  if (p.facing < 0) ctx.scale(-1, 1);

  // rim light: tinted silhouette of the same frame, offset 1px toward the bolts.
  // Cheaper than a normal map and it stays on the pixel grid.
  const lv = p.charging ? chargeLevel() : 0;
  if (lv > 0.5) {
    const flick = 0.85 + Math.random() * 0.15;
    rimCtx.clearRect(0, 0, 96, 96);
    rimCtx.globalCompositeOperation = "source-over";
    rimCtx.drawImage(atlasImg, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    rimCtx.globalCompositeOperation = "source-in";
    rimCtx.fillStyle = `rgba(140,210,255,${Math.min(0.8, (0.22 + 0.38 * lv) * flick)})`;
    rimCtx.fillRect(0, 0, f.w, f.h);
    rimCtx.globalCompositeOperation = "source-over";

    const ox = -Math.round(f.w / 2), oy = -f.h + (f.foot || 0);
    const rimDx = p.facing < 0 ? -1 : 1;    // keep the light on the world's right after the flip
    ctx.drawImage(rimCanvas, 0, 0, f.w, f.h, ox + rimDx, oy, f.w, f.h);
    if (lv > 0.85) ctx.drawImage(rimCanvas, 0, 0, f.w, f.h, ox, oy - 1, f.w, f.h);
  }

  const sc = p.sc;
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h,
    -Math.round((f.w * sc) / 2), -f.h * sc + (f.foot || 0) * sc, f.w * sc, f.h * sc);
  ctx.restore();

  if (p.react > 0) {                      // the one-frame "!" above the cat
    const ax = Math.round(p.x + p.w / 2 - world.cam) + 14;
    const ay = Math.round(p.y - 24 - Math.min(6, (1 - p.react / 0.6) * 10));
    ctx.globalAlpha = Math.min(1, p.react * 4);
    text("!", ax + 1, ay + 1, 2, C.ink, "center");   // 1 px ink shadow keeps it readable
    text("!", ax, ay, 2, C.gold, "center");
    ctx.globalAlpha = 1;
  }

  // attack swipe
  if (p.attack > 0.06 && p.attack < 0.2) {
    const ax = p.x + (p.facing > 0 ? p.w + 6 : -6) - world.cam;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(Math.round(ax + p.facing * i * 7), Math.round(p.y + 6 + i * 8), 6, 3);
    }
  }
}

const PLAY_BAND = { y0: 400, y1: 506 };   // gameplay owns this strip; HUD never enters

function card(x, y, w, h, r = 12) {
  ctx.fillStyle = "rgba(9,10,20,0.28)";
  ctx.beginPath();
  ctx.moveTo(x + 6 + r, y + 8);
  ctx.arcTo(x + 6 + w, y + 8, x + 6 + w, y + 8 + h, r);
  ctx.arcTo(x + 6 + w, y + 8 + h, x + 6, y + 8 + h, r);
  ctx.arcTo(x + 6, y + 8 + h, x + 6, y + 8, r);
  ctx.arcTo(x + 6, y + 8, x + 6 + w, y + 8, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = C.paperEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
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
  text(label, x + w / 2, y + 4, s, C.white, "center");
}

function fishGlyph(x, y) {
  ctx.fillStyle = "#A53030";
  ctx.fillRect(x, y + 2, 16, 8);
  ctx.fillRect(x - 5, y, 5, 5);
  ctx.fillRect(x - 5, y + 7, 5, 5);
  ctx.fillStyle = C.red;
  ctx.fillRect(x + 1, y + 3, 14, 6);
  ctx.fillStyle = C.paper;
  ctx.fillRect(x + 9, y + 4, 2, 2);
}

function drawPauseCard() {
  ctx.fillStyle = C.scrim; ctx.fillRect(0, 0, W, H);
  const cw = 360, ch = 250, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  card(cx, cy, cw, ch);
  text("PAUSED", W / 2, cy + 26, 3, C.ink, "center");

  const rows = [
    ["<", ">", "MOVE"],
    ["Z", "", "JUMP"],
    ["X", "", "PAW SWIPE"],
    ["M", "", "MUTE"],
  ];
  rows.forEach((r, i) => {
    const ry = cy + 82 + i * 34;
    keycap(r[0], cx + 54, ry, 18);
    if (r[1]) keycap(r[1], cx + 76, ry, 18);
    text(r[2], cx + 112, ry + 4, 1, C.ink);
  });
  text("P OR ESC TO RESUME", W / 2, cy + ch - 26, 1, C.paperEdge, "center");
}

function setMap(on) {
  const want = !!on && !!(world.level && !world.level.ray) && state.mode === "play";
  if (want && !mapView.on) mapView.t = 0;
  mapView.on = want;
  return mapView.on;
}

function drawMap() {
  if (!mapView.on) return;
  const L = world.level;
  if (!L || L.ray) return;
  mapView.t = Math.min(1, mapView.t + 0.14);
  mapView.sweep = (mapView.sweep + 0.012) % 1;
  const a = mapView.t;

  const pad = 54, head = 64;
  const roomH = Math.max(...L.solids.map((q) => q.y + q.h), H * 0.9);
  const k = Math.min((W - pad * 2) / L.width, (H - pad * 2 - head) / roomH);
  const ox = (W - L.width * k) / 2;
  const oy = pad + head + (H - pad * 2 - head - roomH * k) / 2;
  const X = (x) => ox + x * k, Y = (y) => oy + y * k;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(8,12,18,0.90)";
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = "rgba(115,190,211,0.10)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= L.width; gx += 160) {
    ctx.beginPath(); ctx.moveTo(X(gx), Y(0)); ctx.lineTo(X(gx), Y(roomH)); ctx.stroke();
  }
  for (let gy = 0; gy <= roomH; gy += 80) {
    ctx.beginPath(); ctx.moveTo(X(0), Y(gy)); ctx.lineTo(X(L.width), Y(gy)); ctx.stroke();
  }

  // walls
  for (const q of L.solids) {
    ctx.fillStyle = "rgba(115,190,211,0.20)";
    ctx.fillRect(X(q.x), Y(q.y), Math.max(1, q.w * k), Math.max(1, q.h * k));
    ctx.strokeStyle = "rgba(115,190,211,0.45)";
    ctx.strokeRect(X(q.x) + 0.5, Y(q.y) + 0.5, Math.max(1, q.w * k) - 1, Math.max(1, q.h * k) - 1);
  }
  // moving platforms
  for (const pl of world.plats) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(X(pl.x), Y(pl.y), Math.max(1, pl.w * k), Math.max(2, pl.h * k));
  }

  // coin blips still out there
  for (const c of world.coins) {
    if (c.got) continue;
    ctx.fillStyle = "rgba(226,182,75,0.9)";
    ctx.fillRect(X(c.x) - 1, Y(c.y) - 1, 3, 3);
  }

  // enemy blips + the ground they walk
  for (const e of world.enemies) {
    if (!e.alive) continue;
    ctx.strokeStyle = "rgba(207,87,60,0.35)";
    ctx.beginPath();
    ctx.moveTo(X(e.min), Y(roomH * 0.92)); ctx.lineTo(X(e.max), Y(roomH * 0.92)); ctx.stroke();
    ctx.fillStyle = "#CF573C";
    ctx.fillRect(X(e.x + e.w / 2) - 2, Y(e.y + e.h / 2) - 2, 5, 5);
  }

  // the vacuum: its cone is the reason to look
  const v = world.vac;
  if (v && !v.done) {
    const vx = v.started ? v.x : v.trigger;
    ctx.fillStyle = "rgba(207,87,60,0.18)";
    ctx.beginPath();
    ctx.moveTo(X(vx), Y(roomH * 0.80));
    ctx.lineTo(X(vx - 260), Y(roomH * 0.96));
    ctx.lineTo(X(vx + 260), Y(roomH * 0.96));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#E2B64B";
    ctx.fillRect(X(vx) - 3, Y(roomH * 0.80) - 3, 6, 6);
  }

  // goal
  if (world.goal) {
    ctx.fillStyle = "rgba(115,190,211,0.95)";
    ctx.beginPath();
    ctx.moveTo(X(world.goal.x), Y(world.goal.y) - 5);
    ctx.lineTo(X(world.goal.x) + 5, Y(world.goal.y));
    ctx.lineTo(X(world.goal.x), Y(world.goal.y) + 5);
    ctx.lineTo(X(world.goal.x) - 5, Y(world.goal.y));
    ctx.closePath(); ctx.fill();
  }

  // the cat, with the way it is facing
  const px = X(player.x + player.w / 2), py = Y(player.y + player.h / 2);
  ctx.strokeStyle = "rgba(140,255,193,0.55)";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + player.facing * 46, py - 10);
  ctx.stroke();
  ctx.fillStyle = "#8CFFC1";
  ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.283); ctx.fill();

  // sweep line
  const sx = X(0) + (X(L.width) - X(0)) * mapView.sweep;
  const grad = ctx.createLinearGradient(sx - 60, 0, sx, 0);
  grad.addColorStop(0, "rgba(115,190,211,0)");
  grad.addColorStop(1, "rgba(115,190,211,0.18)");
  ctx.fillStyle = grad;
  ctx.fillRect(sx - 60, Y(0), 60, Y(roomH) - Y(0));

  // header
  text("SENSOR", pad - 10, pad + 14, 3, "rgba(140,255,193,0.95)");
  text(`${L.world}  ${L.name}`, pad - 10, pad + 40, 2, "rgba(230,238,244,0.8)");
  text("HOLD TAB", W - pad + 10, pad + 14, 2, "rgba(230,238,244,0.45)", "right");
  text("you cannot act while watching", W - pad + 10, pad + 36, 1, "rgba(230,238,244,0.35)", "right");

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHUD() {
  const L = LEVELS[state.level];
  state.hudRects.length = 0;
  const hud = (x, y, w, h, r) => { state.hudRects.push({ x, y, w, h }); panel(x, y, w, h, r); };

  // ---- top-left status ----
  hud(16, 14, 262, 50);
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

  // charge meter
  const cw = 120, cx0 = 72, cy0 = 46;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(cx0, cy0, cw, 7);
  const frac = state.charge / state.chargeMax;
  ctx.fillStyle = frac >= 1 ? C.bossEye : C.goldWarm;
  ctx.fillRect(cx0, cy0, Math.round(cw * frac), 7);
  const powSel = POWERS[state.powerId];
  const icon = powerIcons[state.powerId];
  if (icon && icon.complete && icon.naturalWidth) {
    ctx.drawImage(icon, cx0 + cw + 8, cy0 - 5, 18, 18);
  }
  text(powSel.name, cx0, cy0 + 22, 1, powSel.tint);
  const szLabel = player.size === "big" ? "x2" : player.size === "small" ? "x1/2" : "x1";
  text(szLabel, cx0 + cw - 26, cy0 + 22, 1,
       state.charge >= SHIFT_COST ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)");
  if (frac >= 1) {
    ctx.globalAlpha = 0.35 + Math.sin(state.t * 10) * 0.3;
    ctx.fillStyle = powSel.tint;
    ctx.fillRect(cx0 - 2, cy0 - 2, cw + 4, 11);
    ctx.globalAlpha = 1;
    text("C", cx0 + cw + 32, cy0 + 22, 1, C.bossEye);
  }

  // fish count
  fishGlyph(158, 27);
  text(`X ${state.coins}/${state.totalCoins}`, 182, 26, 2, C.white);

  // ---- top-right world plate ----
  hud(W - 262, 14, 246, 50);
  text(`WORLD ${L.world}`, W - 32, 24, 1, "rgba(255,255,255,0.7)", "right");
  text(L.name, W - 32, 38, 2, C.white, "right");

  // ---- boss health ----
  if (world.boss && !world.boss.dead) {
    const bw = 300, bx = W / 2 - bw / 2;
    hud(bx, 14, bw, 50);
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
      text("STOMP IT!", W / 2, 96, 2, "#E8C170", "center");
      ctx.globalAlpha = 1;
    }
  }

  // ---- first-room tutorial (top centre, clear of the play area) ----
  if (state.level === 0 && state.t < 8) {
    const fade = state.t > 6.5 ? Math.max(0, (8 - state.t) / 1.5) : 1;
    ctx.globalAlpha = fade;
    hud(W / 2 - 250, 78, 500, 56);
    text("HELP THE CAT REACH HOME!", W / 2, 92, 2, C.white, "center");
    text("COLLECT FISH, AVOID BIRDS, FIND THE GOAL.", W / 2, 116, 1, "rgba(255,255,255,0.78)", "center");
    ctx.globalAlpha = 1;
  }

  // Controls are not HUD: they live on the title card and in the pause card.

  if (paused) drawPauseCard();
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

  // title card
  card(180, 84, 600, 336);
  text("CAT HERO", W / 2, 118, 6, C.ink, "center");
  text("A VERY SMALL ADVENTURE", W / 2, 180, 2, C.goldDeep, "center");

  ctx.fillStyle = C.paperShade;
  ctx.fillRect(240, 202, 480, 2);

  if (Math.sin(state.t * 4) > -0.3) text("PRESS ENTER OR TAP", W / 2, 226, 2, C.ink, "center");

  const set = state.setIndex === 0 ? "black" : "grey";
  const idle = ATLAS[set].idle;
  const f = idle[Math.floor(state.t * 6) % idle.length];
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, W / 2 - f.w * 1.1, 402 - f.h * 2.2, f.w * 2.2, f.h * 2.2);

  // controls live here, not in the play band
  card(240, 436, 480, 42, 8);
  text("ARROWS MOVE   SPACE JUMP   J PAW   HOLD SHIFT = POWER", W / 2, 450, 1, C.ink, "center");
}

function drawSelect() {
  drawSky();

  const opts = [
    { key: "black", label: "BLACK CAT", sub: "NIMBLE" },
    { key: "grey", label: "GREY CAT", sub: "STEADY" },
  ];

  opts.forEach((o, i) => {
    const cx = W / 2 + (i === 0 ? -180 : 180);
    const sel = state.setIndex === i;
    const lift = sel ? -8 : 0;
    const cw = 268, ch = 344, x = cx - cw / 2, y = 112 + lift;

    card(x, y, cw, ch);
    if (sel) {
      ctx.strokeStyle = C.goldWarm;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 12, y);
      ctx.arcTo(x + cw, y, x + cw, y + ch, 12);
      ctx.arcTo(x + cw, y + ch, x, y + ch, 12);
      ctx.arcTo(x, y + ch, x, y, 12);
      ctx.arcTo(x, y, x + cw, y, 12);
      ctx.closePath();
      ctx.stroke();
      text("*", cx, y - 34, 3, C.goldWarm, "center");
    }

    const frames = ATLAS[o.key].idle;
    const f = frames[Math.floor(state.t * 6) % frames.length];
    ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, cx - f.w, y + 232 - f.h * 2, f.w * 2, f.h * 2);

    text(o.label, cx, y + 252, 2, C.ink, "center");
    text(o.sub, cx, y + 286, 1, sel ? C.goldDeep : C.paperEdge, "center");
  });

  card(230, 478, 500, 40, 8);
  text("ARROWS OR TAP TO SWITCH    ENTER TO START", W / 2, 492, 1, C.ink, "center");
}

function showCard(lines, next, warm = false) {
  state.card = { lines, i: 0, t: 0, next, warm };
  state.mode = "card";
  player.charging = false;
  document.body.classList.add("playing");   // hide the key hint behind the card
}

const OPENING = [
  "Be good, okay? I'm on the night shift.",
  "Click. The door shuts. The house goes quiet...",
  "...and the robot vacuum wakes up on its own.",
];
const ENDING = [
  "Morning. The shift is over.",
  "The floor is spotless. The vacuum is very, very quiet.",
  "Who's a good cat?",
];

function startRun() {
  state.level = 0; state.lives = 3; state.checkpoint = 0;
  loadLevel(0);
}

function drawCard() {
  const c = state.card;
  if (!c) return;
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);

  if (storyImg && storyImg.complete && storyImg.naturalWidth) {
    const k = Math.max(1, Math.floor(Math.min(W / storyImg.width, H / storyImg.height)));
    const iw = storyImg.width * k, ih = storyImg.height * k;
    ctx.drawImage(storyImg, (W - iw) / 2, (H - ih) / 2, iw, ih);
  } else {
    // placeholder night room: a door of hallway light, cat silhouette waiting
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 30, W * 0.5, H * 0.42, 440);
    g.addColorStop(0, "rgba(115,190,211,0.22)");
    g.addColorStop(1, "rgba(9,10,20,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.ink; ctx.fillRect(W * 0.5 - 116, 58, 232, 374);
    ctx.fillStyle = C.waterDeep; ctx.fillRect(W * 0.5 - 100, 74, 200, 342);
    ctx.fillStyle = C.water; ctx.fillRect(W * 0.5 - 100, 74, 84, 342);
    ctx.fillStyle = "rgba(9,10,20,0.55)"; ctx.fillRect(W * 0.5 - 30, 386, 60, 46);
    ctx.fillStyle = C.bossShell;
    ctx.beginPath(); ctx.ellipse(W * 0.5, 438, 34, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.bossEye; ctx.fillRect(W * 0.5 - 18, 428, 5, 5);
    ctx.fillRect(W * 0.5 + 14, 428, 5, 5);
  }

  if (c.warm) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = C.goldWarm; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.fillStyle = "rgba(9,10,20,0.86)"; ctx.fillRect(0, H - 92, W, 92);
  ctx.fillStyle = C.paperEdge; ctx.fillRect(0, H - 92, W, 2);
  const line = c.lines[c.i];
  const chars = Math.min(line.length, Math.floor(c.t * 40));
  text(line.slice(0, chars), 40, H - 62, 2, C.paper);
  if (chars >= line.length && Math.sin(state.t * 4) > 0) text(">", W - 52, H - 40, 2, C.gold);
}

function drawOverlayCard(title, sub, color, stat) {
  ctx.fillStyle = C.scrim; ctx.fillRect(0, 0, W, H);
  const cw = 440, ch = stat ? 210 : 180, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
  card(cx, cy, cw, ch);
  text(title, W / 2, cy + 26, 4, color, "center");
  if (stat) text(stat, W / 2, cy + 84, 2, C.ink, "center");
  if (sub) text(sub, W / 2, cy + (stat ? 126 : 96), 1, C.paperEdge, "center");
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (state.mode === "title") { drawTitle(); return; }
  if (state.mode === "select") { drawSelect(); return; }
  if (state.mode === "card") { drawCard(); drawScreenFlash(); return; }

  if (world.level && world.level.ray && (state.mode === "play" || state.mode === "clear")) {
    RAY.render(ctx);
    if (state.mode === "clear") {
      drawOverlayCard("ROOM CLEAR", "ENTER FOR NEXT", C.ink, `FISH ${state.coins} / ${state.totalCoins}`);
    }
    if (paused) drawPauseCard();
    drawBlastHandoff();
    return;
  }

  const sh = state.shake;
  const ox = sh ? (Math.random() - 0.5) * sh : 0;
  const oy = sh ? (Math.random() - 0.5) * sh : 0;
  ctx.save();
  ctx.translate(Math.round(ox), Math.round(oy));

  if (world.level && world.level.sandbox) {
    drawSandboxBackdrop();
  } else {
    drawSky();
    drawWater();
    drawVacuumBg();
    drawDecor();
    drawSolids();
  }
  drawPlatforms();
  drawGoal();
  drawVacuumFront();
  for (const c of world.coins) if (!c.got) drawCoin(c);
  for (const e of world.enemies) drawEnemy(e);
  if (world.boss) drawBoss();
  for (const g of powerTrail) {
    const frames = ATLAS[state.setIndex === 0 ? "black" : "grey"].bat || ATLAS.black.bat;
    const f = frames[0];
    ctx.globalAlpha = Math.max(0, g.life / g.max) * 0.45;
    ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h,
      Math.round(g.x + g.w / 2 - world.cam) - f.w * 0.5 * (g.f < 0 ? 1 : 1),
      Math.round(g.y + 42 - f.h), f.w, f.h);
    ctx.globalAlpha = 1;
  }
  drawEmberRing();
  drawGroundGlow();
  drawBackAura();
  drawChargeFx();
  drawBackArcs();
  drawOrbitSparks(false);
  drawPlayer();
  drawOrbitSparks(true);
  drawFrontArcs();
  drawPowerFx();
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x - world.cam), Math.round(p.y), p.s, p.s);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  drawHUD();
  drawMap();
  drawScreenFlash();
  drawBlastHandoff();
  drawDev();

  if (state.mode === "clear") {
    drawOverlayCard("ROOM CLEAR", "ENTER FOR NEXT", C.ink, `FISH ${state.coins} / ${state.totalCoins}`);
  }
  if (state.mode === "gameover") {
    drawOverlayCard("GAME OVER", "ENTER TO TRY AGAIN", C.redDeep, `FISH ${state.coins}`);
  }
  if (state.mode === "win") {
    drawSky();
    ctx.fillStyle = C.scrim; ctx.fillRect(0, 0, W, H);
    const cw = 580, ch = 392, cx = W / 2 - cw / 2, cy = H / 2 - ch / 2;
    card(cx, cy, cw, ch);
    text("HOME AT LAST", W / 2, cy + 28, 4, C.ink, "center");
    text("THE DUST KING IS BEATEN", W / 2, cy + 88, 1, C.paperEdge, "center");

    ["black", "grey"].forEach((set, i) => {
      const fr = ATLAS[set].idle;
      const f = fr[Math.floor(state.t * 5 + i) % fr.length];
      const x = W / 2 + (i === 0 ? -150 : 60);
      ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, x, cy + 132, f.w * 1.7, f.h * 1.7);
    });

    text(`FISH ${state.fish}`, W / 2, cy + 300, 3, C.goldDeep, "center");
    text("ENTER TO PLAY AGAIN", W / 2, cy + 348, 1, C.paperEdge, "center");
  }
}

function drawSandboxBackdrop() {
  // neutral dark stage: nothing to mistake for level content
  ctx.fillStyle = "#202e37";
  ctx.fillRect(0, 0, W, H);

  const cam = world.cam;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  const x0 = Math.floor(cam / 32) * 32;
  for (let x = x0; x < cam + W + 32; x += 32) {
    const sx = Math.round(x - cam) + 0.5;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  }

  // floor slab, 32 px grid aligned
  const fy = 470;
  ctx.fillStyle = "#10141f";
  ctx.fillRect(0, fy, W, H - fy);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.moveTo(0, fy + 0.5); ctx.lineTo(W, fy + 0.5); ctx.stroke();
}

function drawGrid() {
  const cam = world.cam;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  const x0 = Math.floor(cam / 32) * 32;
  for (let x = x0; x < cam + W + 32; x += 32) {
    const sx = Math.round(x - cam) + 0.5;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  }
  // floor line, so jump height reads against something
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath(); ctx.moveTo(0, 470.5); ctx.lineTo(W, 470.5); ctx.stroke();
}

function drawGroundGlow() {
  const lv = player.charging ? chargeLevel() : 0;
  if (lv <= 0.02) return;
  const cx = Math.round(player.x + player.w / 2 - world.cam);
  const cy = Math.round(player.y + player.h);
  const r = 22 + 20 * lv;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0, `rgba(164,221,219,${0.22 + 0.22 * lv})`);
  g.addColorStop(0.55, `rgba(115,190,211,${0.10 + 0.12 * lv})`);
  g.addColorStop(1, "rgba(115,190,211,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.34, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

function drawBackAura() {
  const lv = player.charging ? chargeLevel() : 0;
  if (lv <= 0.05) return;
  const cx = player.x + player.w / 2 - world.cam;
  const cy = player.y + 26;
  const r = 30 + 40 * lv;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0, `rgba(180,240,255,${0.18 + 0.22 * lv})`);
  g.addColorStop(1, "rgba(115,190,211,0)");
  ctx.fillStyle = g;
  // clip so the glow stops at the floor — only the ground ellipse lights below the feet
  const floorY = player.y + player.h;
  ctx.beginPath();
  ctx.rect(cx - r - 2, cy - r - 2, (r + 2) * 2, Math.max(0, floorY - (cy - r - 2)));
  ctx.clip();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.restore();
}

// near = drawn after the sprite, far = before it.
// The near half is deliberately louder (2x size, white core, one-frame trail) because
// at this sprite size a small scale difference is invisible.
function drawOrbitSparks(near) {
  const lv = player.charging ? chargeLevel() : (state.burstT > 0 ? 1 : 0);
  if (lv <= 0.05) return;
  const cx = player.x + player.w / 2 - world.cam;
  const cy = player.y + 28;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const o of orbit) {
    if (lv < 0.4 && o !== orbit[0]) continue;
    const depth = Math.sin(o.a);
    if ((depth > 0) !== near) continue;
    const x = cx + Math.cos(o.a) * o.r;
    const y = cy + depth * o.r * o.tilt;

    if (near) {
      const k = 0.9 + 0.5 * depth;
      const sz = Math.max(2, Math.round(o.size * 2 * k));
      // one-frame trail back along the orbit
      if (o.px !== undefined) {
        ctx.globalAlpha = 0.45 * lv;
        ctx.strokeStyle = "#73BED3";
        ctx.lineWidth = Math.max(1, sz - 1);
        ctx.beginPath();
        ctx.moveTo(o.px + (x - o.px) * 0.6, o.py + (y - o.py) * 0.6);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = Math.min(1, lv * 1.5);
      ctx.fillStyle = "rgba(140,210,255,0.35)";
      ctx.fillRect(Math.round(x) - (sz >> 1) - 2, Math.round(y) - (sz >> 1) - 2, sz + 4, sz + 4);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(Math.round(x) - (sz >> 1), Math.round(y) - (sz >> 1), sz, sz);
    } else {
      const k = 0.5 + 0.25 * (depth + 1);
      const sz = Math.max(1, Math.round(o.size * k));
      ctx.globalAlpha = (0.35 + 0.3 * lv) * (0.6 + 0.4 * (depth + 1) / 2);
      ctx.fillStyle = "#4F8FBA";
      ctx.fillRect(Math.round(x) - (sz >> 1), Math.round(y) - (sz >> 1), sz, sz);
      o.px = undefined;
      continue;
    }
    o.px = x; o.py = y;
  }
  ctx.restore();
}

function drawBackArcs() {
  const lv = player.charging ? chargeLevel() : 0;
  if (lv < 0.45) return;
  const cx = player.x + player.w / 2 - world.cam;
  const cy = player.y + 34;                       // hips
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55 + 0.35 * lv;
  const n = lv > 0.8 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const dir = -player.facing;                   // backwards, behind the tail
    let x = cx + dir * 8;
    let y = cy + (Math.random() - 0.5) * 8;
    const pts = [[x, y]];
    for (let k = 0; k < 3; k++) {
      x += dir * (7 + Math.random() * 8);
      y += (Math.random() - 0.4) * 14;
      pts.push([x, y]);
    }
    for (const [col, wd] of [["rgba(115,190,211,0.5)", 3], ["rgba(180,230,255,0.8)", 1]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFrontArcs() {
  const lv = player.charging ? chargeLevel() : 0;
  if (lv < 0.6) return;
  const cx = player.x + player.w / 2 - world.cam;
  const cy = player.y + 22;
  const n = lv > 0.9 ? 4 : 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI * 0.85 + (i + Math.random() * 0.4) * (Math.PI * 1.2 / n);
    let x = cx + Math.cos(ang) * 6;
    let y = cy + Math.sin(ang) * 6;
    const pts = [[x, y]];
    let a = ang;
    for (let k = 0; k < 3; k++) {
      a += (Math.random() - 0.5) * 0.9;
      const L = 9 + Math.random() * 9;
      x += Math.cos(a) * L;
      y += Math.sin(a) * L;
      pts.push([x, y]);
    }
    // cyan halo then white core
    for (const [col, wd] of [["rgba(115,190,211,0.55)", 3], ["rgba(235,237,233,0.95)", 1]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawDecal() {
  if (state.decalT <= 0) return;
  const t = 1 - state.decalT;
  const x = state.decalX - world.cam;
  const r = 18 + t * 46;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = (1 - t) * 0.55;
  ctx.strokeStyle = "#73BED3";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, state.decalY, r, r * 0.3, 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = (1 - t) * 0.25;
  ctx.beginPath(); ctx.ellipse(x, state.decalY, r * 0.6, r * 0.18, 0, 0, 7); ctx.stroke();
  ctx.restore();
}

function drawScreenFlash() {
  if (state.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.55, state.flash * 0.55);
  ctx.fillStyle = "#EBEDE9";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  state.flash = Math.max(0, state.flash - 0.12);
}

function drawChargeFx() {
  if (!fxImg || !fxMeta || state.mode !== "play") return;
  const [fw, fh] = fxMeta.frame;
  let idx = -1;
  if (player.charging) {
    const last = fxMeta.burstStart - 1;
    idx = Math.max(0, Math.min(last, Math.floor((state.charge / state.chargeMax) * last)));
  } else if (state.burstT > 0) {
    const span = fxMeta.frames - fxMeta.burstStart;
    const done = 1 - state.burstT / ((fxMeta.frames - fxMeta.burstStart) / fxMeta.fps);
    idx = fxMeta.burstStart + Math.min(span - 1, Math.floor(done * span));
  }
  if (idx < 0 || idx >= fxMeta.frames) return;

  const S = 1.0;
  const cx = player.x + player.w / 2 - world.cam - 4;
  const cy = player.y + 34;
  const dx = Math.round(cx - fxPivot[0] * S);
  const dy = Math.round(cy - fxPivot[1] * S);
  ctx.drawImage(fxImg, idx * fw, 0, fw, fh, dx, dy, Math.round(fw * S), Math.round(fh * S));
}

function drawEmberRing() {
  if (state.emberVfx <= 0) return;
  const p = player;
  const t = 1 - state.emberVfx / 0.4;
  const r = 20 + t * 150;
  ctx.globalAlpha = 0.8 * (1 - t);
  ctx.strokeStyle = state.ringColor || C.goldWarm;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(p.x + p.w / 2 - world.cam, p.y + p.h / 2, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x + p.w / 2 - world.cam, p.y + p.h / 2, r * 0.82, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPowerFx() {
  const p = player;
  if (p.power <= 0) return;
  const cx = p.x + p.w / 2 - world.cam, cy = p.y + p.h / 2;
  ctx.strokeStyle = C.bossEye;
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    let x = cx - p.facing * 40, y = cy + (k - 1) * 10;
    ctx.moveTo(x, y);
    for (let i = 0; i < 5; i++) {
      x += p.facing * 14;
      y += (Math.random() - 0.5) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.5 + Math.sin(state.t * 30) * 0.3;
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDev() {
  if (!DEV) return;
  const p = player;
  if (dev.hitboxes && state.mode === "play") {
    const cx = world.cam;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ff3b30";
    ctx.strokeRect(Math.round(p.x - cx), Math.round(p.y), p.w, p.h);
    ctx.strokeStyle = "#ffcc00";
    for (const en of world.enemies) if (en.alive) ctx.strokeRect(Math.round(en.x - cx), Math.round(en.y), en.w, en.h);
    ctx.strokeStyle = "#ff00ff";
    if (world.boss) ctx.strokeRect(Math.round(world.boss.x - cx), Math.round(world.boss.y), world.boss.w, world.boss.h);
    if (world.level.solids) {
      ctx.strokeStyle = "rgba(0,255,200,0.45)";
      for (const sd of world.level.solids) ctx.strokeRect(Math.round(sd.x - cx), Math.round(sd.y), sd.w, sd.h);
    }
    ctx.strokeStyle = "rgba(120,200,255,0.55)";
    for (const pl of world.plats) ctx.strokeRect(Math.round(pl.x - cx), Math.round(pl.y), pl.w, pl.h);
  }
  if (!dev.overlay) return;
  panel(16, H - 128, 340, 112);
  text(`DEV  ${Math.round(dev.fps)} fps  x${dev.timeScale.toFixed(1)}`, 30, H - 118, 1, "#8CFFC1");
  text(`anim ${p.anim} #${p.frame}  vy ${Math.round(p.vy)}`, 30, H - 102, 1, "#FFFFFF");
  text(`pos ${Math.round(p.x)},${Math.round(p.y)}  ground ${p.onGround ? 1 : 0}`, 30, H - 86, 1, "#FFFFFF");
  text(`H hitbox  G god  [ ] speed  N spawn`, 30, H - 70, 1, "#9AA7B2");
  text(`K clear  T goal  L next  F charge  Q/E shift`, 30, H - 54, 1, "#9AA7B2");
  text(`charge ${Math.round(state.charge)}/${state.chargeMax}  C = power`, 30, H - 38, 1, "#8CFFC1");
}

/* --------------------------------------------------------- blast handoff */
/* Ray room -> boss room used to be a hard cut. Now the white flash is held,
   the new room is swapped in behind it, and it fades onto the cat already
   airborne (loadLevel's introBlast pose). The handoff owns the flash, so the
   introBlast flash is suppressed — one flash, not two. */
function beginBlastHandoff() {
  if (state.handoff) return;
  const next = state.level + 1;
  if (next >= LEVELS.length) return;
  state.flash = 0;                                // the overlay replaces it
  state.handoff = { t: 0, hold: BLAST_HOLD, reveal: BLAST_REVEAL,
                    level: next, swapped: false, done: false, alpha: 0 };
}

function updateHandoff(dt) {
  const h = state.handoff;
  if (!h) return;
  h.t += dt;
  if (!h.swapped && h.t >= h.hold) {
    h.swapped = true;
    state.level = h.level;
    state.checkpoint = 0;
    loadLevel(h.level, { introBlast: true, holdFlash: true });
    syncSandbox();                  // dev panel label follows the handoff
  }
  if (!h.swapped) h.alpha = Math.min(1, h.t / 0.10);
  else h.alpha = Math.max(0, 1 - (h.t - h.hold) / h.reveal);
  if (h.swapped && h.alpha <= 0) { h.done = true; state.handoff = null; }
}

function drawBlastHandoff() {
  const h = state.handoff;
  if (!h) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, h.alpha));
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ------------------------------------------------------------------ loop */
let last = performance.now(), acc = 0;
const STEP = 1 / 120;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (DEV) { dev.fps = dev.fps * 0.9 + (1 / Math.max(dt, 0.0001)) * 0.1; dt *= dev.timeScale; }
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 8) { update(STEP); acc -= STEP; }

  // menu confirm
  if (queued.confirm) {
    queued.confirm = false;
    if (state.mode === "title") { state.mode = "select"; beep(660, 0.07, "square", 0.08); }
    else if (state.mode === "select") { beep(880, 0.09, "square", 0.09); showCard(OPENING, startRun); }
    else if (state.mode === "card" && state.card) {
      const c = state.card, full = c.lines[c.i].length / 40;
      if (c.t < full) c.t = full;                       // finish typing first
      else if (c.i < c.lines.length - 1) { c.i++; c.t = 0; }
      else { const next = c.next; state.card = null; next(); }
    }
    else if (state.mode === "clear") {
      if (state.level + 1 >= DEMO_COUNT) showCard(ENDING, () => { state.mode = "win"; }, true);
      else { state.level++; state.checkpoint = 0; loadLevel(state.level); }
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
  try { localStorage.setItem("cathero.muted", state.muted ? "1" : "0"); } catch (e) { }
}

function boot() {
  if (DEV) {
    const idx = LEVELS.findIndex((L) => L.sandbox);
    if (idx >= 0) { state.level = idx; state.lives = 3; loadLevel(idx); }
  }
  try {
    const legacy = localStorage.getItem("cath hero muted");
    const now = localStorage.getItem("cathero.muted");
    state.muted = (now ?? legacy) === "1";
  } catch (e) { }
  ATLAS = window.__CAT_ATLAS__;
  RAY = CatRay.create({
    W, H, state, player, keys, queued, sfx, ac, addCharge,
    text: (s, x, y, size, col, align) => text(s, x, y, size, col, align),
    onClear: () => { state.mode = "clear"; sfx.win(); },
    onBlast: () => beginBlastHandoff(),
  });
  fit();
  initSandboxUI();
  window.__GAME = { state, player, world, LEVELS, LEVELS_EXTRA, DEMO_COUNT, keys, queued, loadLevel,
                    showCard, OPENING, ENDING, RAY, releaseCharge, jumpToStage, restartStage, gotoBeat,
                    shiftSize, setSize, cycleSize, SZ, SHIFT_COST, hurt, setMap, mapView };
  requestAnimationFrame(frame);
}

fetch(`assets/cat-atlas.json?v=${ART_V}`).then((r) => r.json()).then((j) => {
  window.__CAT_ATLAS__ = j;
  atlasImg.onload = boot;
  atlasImg.src = `assets/cat-atlas.png?v=${ART_V}`;
}).catch((e) => {
  ctx.fillStyle = "#E7D5B3"; ctx.fillRect(0, 0, W, H);
  text("ATLAS FAILED TO LOAD", W / 2, H / 2, 3, "#CF573C", "center");
  console.error(e);
});

})();
