/* CAT HERO — a small pixel platformer built around the sprite sheet.
   No dependencies. Canvas 2D at a fixed 960x540 logical resolution. */
(() => {
"use strict";

const W = 960, H = 540, TILE = 32;
const GRAV = 2200, JUMP_V = -690, MOVE = 272, ACCEL = 2600, FRIC = 2400, MAXFALL = 980;
const COYOTE = 0.09, JUMP_BUF = 0.12;

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
};

/* ----------------------------------------------------------------- input */
const MAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump",
  KeyJ: "bat", KeyX: "bat", KeyZ: "bat",
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
  const on = (e) => { e.preventDefault(); keys[k] = true; if (k === "jump") queued.jump = true; if (k === "bat") queued.bat = true; if (k === "pending") { } };
  const off = (e) => { e.preventDefault(); keys[k] = false; };
  b.addEventListener("pointerdown", on);
  b.addEventListener("pointerup", off);
  b.addEventListener("pointercancel", off);
  b.addEventListener("pointerleave", off);
});

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
    name: "THE LIVING ROOM",
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
  },
  {
    name: "THE SHELF",
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
  },
  {
    name: "THE GARDEN",
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
  },
];

/* ---------------------------------------------------------------- player */
const player = {
  x: 0, y: 0, w: 34, h: 42, vx: 0, vy: 0, facing: 1,
  onGround: false, coyote: 0, buf: 0, anim: "idle", animT: 0, frame: 0,
  attack: 0, cooldown: 0, invuln: 0, dead: false, spawnX: 0, spawnY: 0,
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
  world.goal = { x: L.goal.x, y: L.goal.y, t: 0 };
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
  goal: null, time: 0, checkpoint: 0,
};

/* ------------------------------------------------------------- collision */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidHit(box) {
  for (const s of world.level.solids) if (overlaps(box, s)) return s;
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
  box = rect(p.x, p.y, p.w, p.h);
  s = solidHit(box);
  if (s) {
    if (p.vy > 0) {
      p.y = s.y - p.h;
      if (p.vy > 420) { sfx.land(); dust(p.x + p.w / 2, p.y + p.h, 4); }
      p.vy = 0;
      p.onGround = true;
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
  if (world.goal && overlaps(rect(p.x, p.y, p.w, p.h), rect(world.goal.x - 40, world.goal.y - 70, 90, 70))) {
    state.mode = "clear"; sfx.win(); state.shake = 6;
    burst(world.goal.x, world.goal.y - 40, 30, "#f2c14e");
  }

  // camera
  const target = Math.max(0, Math.min(p.x + p.w / 2 - W * 0.42, world.level.width - W));
  world.cam += (target - world.cam) * Math.min(1, dt * 8);

  updateParticles(dt);
  state.shake = Math.max(0, state.shake - dt * 40);
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
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#f7efd9");
  g.addColorStop(0.6, "#f0e6c8");
  g.addColorStop(1, "#e6d9b6");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sun
  ctx.fillStyle = "#f6dc9c";
  ctx.beginPath(); ctx.arc(W - 130, 110, 54, 0, 7); ctx.fill();

  const cam = world.cam || 0;
  // far hills
  ctx.fillStyle = "#e3d3ad";
  for (let i = 0; i < 8; i++) {
    const x = ((i * 380 - cam * 0.18) % (8 * 380) + 8 * 380) % (8 * 380) - 300;
    const h = 150 + (i % 3) * 40;
    ctx.beginPath(); ctx.ellipse(x + 190, 520, 260, h, 0, Math.PI, 0); ctx.fill();
  }
  // near hills
  ctx.fillStyle = "#d8c49a";
  for (let i = 0; i < 10; i++) {
    const x = ((i * 300 - cam * 0.35) % 3000 + 3000) % 3000 - 200;
    const h = 90 + (i % 4) * 22;
    ctx.beginPath(); ctx.ellipse(x + 150, 520, 200, h, 0, Math.PI, 0); ctx.fill();
  }
  // clouds
  ctx.fillStyle = "#fbf5e4";
  for (let i = 0; i < 7; i++) {
    const x = ((i * 340 - cam * 0.12) % 2380 + 2380) % 2380 - 120;
    const y = 70 + (i % 3) * 46;
    ctx.fillRect(x, y, 74, 16); ctx.fillRect(x + 14, y - 10, 46, 12);
    ctx.fillRect(x + 26, y - 18, 24, 10);
  }
}

function drawSolids() {
  const cam = world.cam;
  for (const s of world.level.solids) {
    if (s.x + s.w < cam - 40 || s.x > cam + W + 40) continue;
    const x = Math.round(s.x - cam), y = Math.round(s.y);
    const big = s.h > 40;
    ctx.fillStyle = big ? "#5c3a21" : "#7a4f2d";
    ctx.fillRect(x, y, s.w, s.h);
    // top edge
    ctx.fillStyle = big ? "#7a4f2d" : "#95643c";
    ctx.fillRect(x, y, s.w, 6);
    ctx.fillStyle = big ? "#8a5c34" : "#b07a4a";
    ctx.fillRect(x, y, s.w, 2);
    // plank texture
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let px = 0; px < s.w; px += 32) {
      ctx.fillRect(x + px, y + 8, 2, s.h - 8);
      const off = ((px * 7 + s.y) % 3) * 6;
      ctx.fillRect(x + px + 6, y + 14 + off, 12, 2);
    }
    // grass tufts on wide ground
    if (big) {
      ctx.fillStyle = "#8fae62";
      for (let px = 4; px < s.w - 4; px += 46) {
        const hh = 4 + ((px * 13 + s.x) % 5);
        ctx.fillRect(x + px, y - hh, 3, hh);
        ctx.fillRect(x + px + 7, y - hh + 2, 3, hh - 2);
      }
    }
  }
}

function drawCoin(c) {
  const bob = Math.sin(c.t * 4) * 3;
  const x = Math.round(c.x - world.cam), y = Math.round(c.y + bob);
  // fish coin: body + tail + eye
  ctx.fillStyle = "#c99a2e";
  ctx.fillRect(x - 9, y - 6, 18, 12);
  ctx.fillRect(x - 11, y - 3, 3, 6);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(x - 8, y - 5, 15, 10);
  ctx.fillRect(x - 10, y - 2, 2, 4);
  ctx.fillStyle = "#fff6d8";
  ctx.fillRect(x + 2, y - 3, 3, 3);
  ctx.fillStyle = "#5c3a21";
  ctx.fillRect(x + 3, y - 2, 2, 2);
  ctx.fillStyle = "#c99a2e";
  ctx.fillRect(x - 10, y - 6, 3, 3);
  ctx.fillRect(x - 10, y + 3, 3, 3);
}

function drawEnemy(e) {
  const x = Math.round(e.x - world.cam), y = Math.round(e.y);
  if (!e.alive) {
    if (e.squash > 0) {
      ctx.fillStyle = "#4a4038";
      ctx.fillRect(x + 2, y + e.h - 8, e.w - 4, 8);
      ctx.fillStyle = "#c2452f";
      ctx.fillRect(x + e.w / 2 - 4, y + e.h - 6, 8, 2);
    }
    return;
  }
  const wob = Math.sin(e.t * 9) * 1.5;
  // body (round robot vacuum)
  ctx.fillStyle = "#3a332c";
  ctx.fillRect(x + 2, y + 6, e.w - 4, e.h - 8);
  ctx.fillRect(x + 6, y + 2, e.w - 12, 4);
  ctx.fillStyle = "#57504a";
  ctx.fillRect(x + 4, y + 8, e.w - 8, 6);
  // eye
  ctx.fillStyle = "#c2452f";
  ctx.fillRect(x + e.w / 2 - 6 + wob, y + 10, 12, 4);
  ctx.fillStyle = "#ff8a6a";
  ctx.fillRect(x + e.w / 2 - 4 + wob, y + 11, 4, 2);
  // wheels
  ctx.fillStyle = "#241f1a";
  ctx.fillRect(x + 4, y + e.h - 6, 8, 6);
  ctx.fillRect(x + e.w - 12, y + e.h - 6, 8, 6);
  // brush
  ctx.fillStyle = "#6b6259";
  ctx.fillRect(x + e.w / 2 - 8, y + e.h - 4, 16, 2);
}

function drawGoal() {
  const g = world.goal; if (!g) return;
  const x = g.x - world.cam, y = g.y;
  const pulse = 1 + Math.sin(state.t * 3) * 0.02;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  // cushion
  ctx.fillStyle = "#5c3a21";
  ctx.beginPath();
  ctx.moveTo(-52, 0); ctx.lineTo(-44, -34); ctx.lineTo(44, -34); ctx.lineTo(52, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#8a5c34";
  ctx.beginPath();
  ctx.moveTo(-44, -6); ctx.lineTo(-38, -30); ctx.lineTo(38, -30); ctx.lineTo(44, -6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d9b26a";
  ctx.fillRect(-4, -30, 8, 24);
  ctx.fillRect(-30, -24, 60, 4);
  // tassels
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(-52, -4, 6, 6); ctx.fillRect(46, -4, 6, 6);
  // sparkle
  const s = (Math.sin(state.t * 5) + 1) / 2;
  ctx.fillStyle = `rgba(255,246,216,${0.4 + s * 0.6})`;
  ctx.fillRect(-6, -56, 4, 12); ctx.fillRect(-10, -52, 12, 4);
  ctx.restore();
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

function drawHUD() {
  // hearts
  for (let i = 0; i < 3; i++) {
    const on = i < state.lives;
    const x = 22 + i * 34, y = 20;
    ctx.fillStyle = on ? "#c2452f" : "rgba(27,20,16,0.18)";
    ctx.fillRect(x + 2, y, 6, 4); ctx.fillRect(x + 14, y, 6, 4);
    ctx.fillRect(x, y + 4, 22, 8);
    ctx.fillRect(x + 3, y + 12, 16, 4);
    ctx.fillRect(x + 7, y + 16, 8, 3);
    if (on) { ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(x + 4, y + 5, 4, 3); }
  }
  // fish counter icon
  const fx = 138, fy = 18;
  ctx.fillStyle = "#c99a2e";
  ctx.fillRect(fx, fy + 3, 20, 12);
  ctx.fillRect(fx - 7, fy, 7, 6);
  ctx.fillRect(fx - 7, fy + 12, 7, 6);
  ctx.fillRect(fx - 3, fy + 4, 4, 10);
  ctx.fillStyle = "#f2c14e";
  ctx.fillRect(fx + 1, fy + 4, 17, 10);
  ctx.fillStyle = "#fff6d8";
  ctx.fillRect(fx + 5, fy + 6, 4, 4);
  ctx.fillStyle = "#5c3a21";
  ctx.fillRect(fx + 6, fy + 7, 2, 2);
  text(`${state.coins}/${state.totalCoins}`, fx + 30, fy + 1, 2, "#1b1410");

  // level name
  text(LEVELS[state.level].name, W - 24, 20, 2, "rgba(27,20,16,0.55)", "right");

  if (paused) {
    ctx.fillStyle = "rgba(20,16,13,0.62)"; ctx.fillRect(0, 0, W, H);
    text("PAUSED", W / 2, H / 2 - 40, 5, "#f0e6c8", "center");
    text("P TO RESUME", W / 2, H / 2 + 30, 2, "#b9a686", "center");
  }
  if (state.muted) text("MUTED", W - 24, 48, 2, "rgba(27,20,16,0.45)", "right");
}

function drawTitle() {
  drawSky();
  // ground strip
  ctx.fillStyle = "#5c3a21"; ctx.fillRect(0, 470, W, 70);
  ctx.fillStyle = "#7a4f2d"; ctx.fillRect(0, 470, W, 6);
  ctx.fillStyle = "#8fae62";
  for (let x = 0; x < W; x += 46) { const h = 4 + ((x * 13) % 6); ctx.fillRect(x + 4, 470 - h, 3, h); }

  text("CAT HERO", W / 2, 96, 9, "#1b1410", "center");
  text("A VERY SMALL ADVENTURE", W / 2, 180, 2, "#7a6a52", "center");

  const set = state.setIndex === 0 ? "black" : "grey";
  const idle = ATLAS[set].idle;
  const f = idle[Math.floor(state.t * 6) % idle.length];
  ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, W / 2 - f.w, 470 - f.h * 2, f.w * 2, f.h * 2);

  const blink = Math.sin(state.t * 4) > -0.2;
  if (blink) text("PRESS ENTER", W / 2, 252, 3, "#1b1410", "center");
  text("ARROWS MOVE   SPACE JUMP   J PAW", W / 2, 306, 2, "#7a6a52", "center");
}

function drawSelect() {
  drawSky();
  text("CHOOSE YOUR HERO", W / 2, 70, 4, "#1b1410", "center");
  const opts = [
    { key: "black", label: "BLACK CAT", sub: "NIMBLE" },
    { key: "grey", label: "GREY CAT", sub: "STEADY" },
  ];
  opts.forEach((o, i) => {
    const cx = W / 2 + (i === 0 ? -190 : 190);
    const sel = state.setIndex === i;
    ctx.fillStyle = sel ? "rgba(242,193,78,0.35)" : "rgba(27,20,16,0.06)";
    ctx.fillRect(cx - 140, 150, 280, 250);
    ctx.strokeStyle = sel ? "#1b1410" : "rgba(27,20,16,0.2)";
    ctx.lineWidth = sel ? 4 : 2;
    ctx.strokeRect(cx - 140, 150, 280, 250);

    const frames = ATLAS[o.key].idle;
    const f = frames[Math.floor(state.t * 6) % frames.length];
    const sc = 1.7;
    ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, cx - f.w * sc / 2, 380 - f.h * sc, f.w * sc, f.h * sc);
    text(o.label, cx, 410, 2, "#1b1410", "center");
    text(o.sub, cx, 440, 1, "#7a6a52", "center");
    if (sel) text("*", cx, 128, 3, "#c2452f", "center");
  });
  text("ARROWS TO SWITCH   ENTER TO START", W / 2, 500, 1, "#7a6a52", "center");
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
  drawSolids();
  drawGoal();
  for (const c of world.coins) if (!c.got) drawCoin(c);
  for (const e of world.enemies) drawEnemy(e);
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
    ctx.fillStyle = "#f0e6c8"; ctx.fillRect(0, 0, W, H);
    text("HERO OF THE HOUSE", W / 2, 120, 5, "#1b1410", "center");
    text("ALL THREE ROOMS CLEARED", W / 2, 200, 2, "#7a6a52", "center");
    text(`FISH ${state.fish}`, W / 2, 250, 3, "#c99a2e", "center");
    ["black", "grey"].forEach((set, i) => {
      const fr = ATLAS[set].idle;
      const f = fr[Math.floor(state.t * 5 + i) % fr.length];
      const x = W / 2 + (i === 0 ? -150 : 90);
      ctx.drawImage(atlasImg, f.x, f.y, f.w, f.h, x, 380 - f.h * 1.6, f.w * 1.6, f.h * 1.6);
    });
    text("ENTER TO PLAY AGAIN", W / 2, 470, 2, "#1b1410", "center");
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
