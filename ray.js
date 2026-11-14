/* ray.js — Cat Hero raycaster room type (Game Off 2026)
 * Load BEFORE game.js:  <script src="ray.js"></script>
 * game.js creates one instance in boot():  const RAY = CatRay.create(host)
 * and routes rooms with `ray: true` to it. No globals besides window.CatRay.
 *
 * Room schema (a LEVELS entry):
 *   { world, name, ray: true, grid: [...rows], dark?: bool, theme?: "bin"|"motor",
 *     face?: [dx,dy], chargeRate?: number, hint?: string }
 * Grid legend:
 *   #  wall            d  dust pile (0.45 high, solid)   D  exit door (opens when near)
 *   E  exhaust grill   B  brush wall (timed open/close)  S  start
 *   T  toy pickup (+25 charge)                           M  motor core (full charge here → blast)
 */
(function () {
  "use strict";

  const RW = 320, RH = 180, HOR = RH >> 1;
  const FOVP = 0.66, PROJ = (RW / 2) / FOVP;     // ≈ 66° horizontal FOV
  const CAMZ = 0.35;                              // cat eye height (room height = 1)
  const RAD = 0.22, MOVE = 2.4, TURN = 2.6;
  const BRUSH_OPEN = 1.2, BRUSH_SHUT = 1.0;

  // Apollo 46 (same palette as game.js `C`). Swap to C.* names when merging if preferred.
  const AP = {
    ink: "#090a14", night: "#10141f", deep: "#151d28", slate: "#202e37", steel: "#394a50",
    sage: "#577277", mist: "#819796", fog: "#a8b5b2", pale: "#c7cfcc", white: "#ebede9",
    navy: "#172038", blue: "#253a5e", sky: "#3c5e8b", azure: "#4f8fba", cyan: "#73bed3", ice: "#a4dddb",
    moss: "#25562e", leaf: "#468232", lime: "#75a743", plum: "#402751", grape: "#7a367b", pink: "#df84a5",
    rust: "#4d2b32", brown: "#7a4841", tan: "#ad7757", sand: "#c09473", wheat: "#d7b594", cream: "#e7d5b3",
    ember: "#602c2c", copper: "#884b2b", amber: "#be772b", gold: "#de9e41", honey: "#e8c170",
    wine: "#752438", red: "#a53030", coral: "#cf573c", orange: "#da863e",
  };
  const rgb = {}; for (const k in AP) { const n = parseInt(AP[k].slice(1), 16); rgb[k] = [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  // ---------- art assets (user-supplied) ----------
  const TEX = {};
  let pawsImg = null, pawsAtlas = null;
  function loadTex(name, src, w, h) {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = true;
      g.drawImage(im, 0, 0, w, h);
      TEX[name] = { d: g.getImageData(0, 0, w, h).data, w, h };
    };
    im.onerror = () => { if (window.console) console.warn("ray art missing:", src); };
    im.src = src;
  }
  loadTex("wall-metal", "assets/ray/wall-metal.png", 128, 128);
  loadTex("wall-mold",  "assets/ray/wall-mold.png",  128, 128);
  loadTex("wall-rust",  "assets/ray/wall-rust.png",  128, 128);
  loadTex("wall-wet",   "assets/ray/wall-wet.png",   128, 128);
  loadTex("door",       "assets/ray/door.png",       128, 128);
  loadTex("vent",       "assets/ray/vent.png",       128, 128);
  loadTex("motor",      "assets/ray/motor.png",       96, 128);
  fetch("assets/paws.json").then((r) => r.json()).then((j) => {
    pawsAtlas = j;
    const im = new Image(); im.onload = () => { pawsImg = im; }; im.src = "assets/paws.png";
  }).catch(() => { });
  function sample(name, u, v) {
    const t = TEX[name]; if (!t) return null;
    let x = Math.floor(u * t.w); if (x < 0) x = 0; else if (x >= t.w) x = t.w - 1;
    let y = Math.floor(v * t.h); if (y < 0) y = 0; else if (y >= t.h) y = t.h - 1;
    const i = (y * t.w + x) * 4, d = t.d;
    if (d[i + 3] < 96) return null;
    return [d[i], d[i + 1], d[i + 2]];
  }

  const THEMES = {
    bin:   { key: "bin", floorA: rgb.slate, floorB: rgb.deep, line: rgb.night, ceil: rgb.night, wall: rgb.steel, mortar: rgb.slate, fog: rgb.ink },
    motor: { key: "motor", floorA: rgb.rust, floorB: rgb.ember, line: rgb.ink, ceil: rgb.deep, wall: rgb.brown, mortar: rgb.rust, fog: rgb.ink },
  };
  const TOY_COLS = [rgb.lime, rgb.grape, rgb.fog];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function create(host) {
    const { state, player, keys, queued } = host;
    const sfx = host.sfx || {};
    const W = host.W || 960, H = host.H || 540;

    const cv = document.createElement("canvas"); cv.width = RW; cv.height = RH;
    const cx = cv.getContext("2d");
    const img = cx.createImageData(RW, RH);
    const buf = new Uint32Array(img.data.buffer);
    const zbuf = new Float32Array(RW);
    const shorts = Array.from({ length: RW }, () => []);
    const hitD = new Float32Array(16), hitH = new Float32Array(16), hitU = new Float32Array(16), hitS = new Uint8Array(16), hitK = new Array(16), hitX = new Int16Array(16), hitY = new Int16Array(16);

    let L = null, grid = null, gw = 0, gh = 0, th = THEMES.bin;
    const R = {
      x: 0, y: 0, dx: 1, dy: 0, plx: 0, ply: FOVP, bob: 0, t: 0,
      toys: [], got: 0, motor: null, doorT: 0, doorOpen: false, cleared: false,
      brushes: new Map(), safe: { x: 0, y: 0 }, burst: 0, flash: 0, shake: 0,
      blast: null, msg: "", msgT: 0, wasFull: false, hum: null,
    };

    // ---------- grid ----------
    const cell = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh) ? "#" : grid[y][x];
    function brushClosed(x, y) {               // 0 = open, 1 = shut
      const ph = R.brushes.get(x + "," + y); if (ph === undefined) return 0;
      const P = BRUSH_OPEN + BRUSH_SHUT, t = (R.t + ph) % P;
      if (t < BRUSH_OPEN - 0.2) return 0;
      if (t < BRUSH_OPEN) return (t - (BRUSH_OPEN - 0.2)) / 0.2;           // closing
      if (t < P - 0.2) return 1;
      return 1 - (t - (P - 0.2)) / 0.2;                                     // opening
    }
    function tileH(x, y) {                     // render height (0 = nothing)
      const c = cell(x, y);
      if (c === "#" || c === "E") return 1;
      if (c === "d") return 0.45;
      if (c === "D") return 1 - R.doorT * 0.92;
      if (c === "B") return 0.06 + 0.94 * brushClosed(x, y);
      return 0;
    }
    function solid(x, y) {
      const c = cell(x, y);
      if (c === "B") return brushClosed(x, y) > 0.5;
      if (c === "D") return R.doorT < 1;
      if (c === "M") return true;
      return c === "#" || c === "E" || c === "d";
    }
    function free(x, y) {
      return !solid(Math.floor(x - RAD), Math.floor(y - RAD)) && !solid(Math.floor(x + RAD), Math.floor(y - RAD)) &&
             !solid(Math.floor(x - RAD), Math.floor(y + RAD)) && !solid(Math.floor(x + RAD), Math.floor(y + RAD));
    }
    function setDir(dx, dy) { const l = Math.hypot(dx, dy) || 1; R.dx = dx / l; R.dy = dy / l; R.plx = -R.dy * FOVP; R.ply = R.dx * FOVP; }

    // ---------- lifecycle ----------
    function enter(level) {
      L = level; th = THEMES[L.theme || (L.dark ? "bin" : "motor")] || THEMES.bin;
      grid = L.grid.map((r) => r.split("")); gh = grid.length; gw = grid[0].length;
      R.toys = []; R.got = 0; R.motor = null; R.brushes.clear(); R.doorT = 0; R.doorOpen = false; R.cleared = false;
      R.burst = 0; R.flash = 0.5; R.shake = 0; R.blast = null; R.t = 0; R.msg = L.hint || ""; R.msgT = L.hint ? 4 : 0;
      let bi = 0;
      grid.forEach((row, y) => row.forEach((c, x) => {
        if (c === "S") { R.x = x + 0.5; R.y = y + 0.5; R.safe = { x: R.x, y: R.y }; row[x] = "."; }
        if (c === "T") { R.toys.push({ x: x + 0.5, y: y + 0.5, got: false, k: R.toys.length % 3 }); row[x] = "."; }
        if (c === "M") R.motor = { x: x + 0.5, y: y + 0.5 };
        if (c === "B") R.brushes.set(x + "," + y, (bi++) * 0.9);
      }));
      const f = L.face || autoFace(); setDir(f[0], f[1]);
      state.charge = 0; player.charging = false; R.wasFull = false;
    }
    function autoFace() {                       // face the longest open corridor from the start
      let best = [1, 0], bl = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let n = 0; while (!solid(Math.floor(R.x) + dx * (n + 1), Math.floor(R.y) + dy * (n + 1)) && n < 20) n++;
        if (n > bl) { bl = n; best = [dx, dy]; }
      }
      return best;
    }
    function exit() { stopHum(); player.charging = false; }

    // ---------- audio (uses the game's shared AudioContext if provided) ----------
    function startHum() {
      const a = host.ac && host.ac(); if (!a || R.hum) return;
      const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
      o.type = "sawtooth"; o.frequency.value = 55; f.type = "lowpass"; f.frequency.value = 300; g.gain.value = 0;
      o.connect(f).connect(g).connect(a.destination); o.start(); R.hum = { a, o, f, g };
    }
    function stopHum() { if (!R.hum) return; try { R.hum.g.gain.setTargetAtTime(0, R.hum.a.currentTime, 0.05); R.hum.o.stop(R.hum.a.currentTime + 0.3); } catch (e) { } R.hum = null; }

    // ---------- update ----------
    function update(dt) {
      R.t += dt; R.msgT -= dt;
      R.flash = Math.max(0, R.flash - dt * 2); R.shake = Math.max(0, R.shake - dt * 30); R.burst = Math.max(0, R.burst - dt);
      queued.jump = false; queued.bat = false;  // no buffered jump/swipe leaking back into 2D

      if (R.blast) {
        R.blast.t += dt; R.shake = 4 + R.blast.t * 18;
        if (R.hum) { R.hum.o.frequency.value = 55 + R.blast.t * 600; R.hum.g.gain.value = 0.08; }
        if (R.blast.t > 0.75 && !R.blast.done) { R.blast.done = true; R.flash = 1; stopHum(); host.onBlast && host.onBlast(); }
        return;
      }

      // movement: ←→ turn, JUMP = forward, PAW/↓ = back (touch reuses JUMP/PAW)
      const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const fwd = (keys.jump ? 1 : 0) - ((keys.bat || keys.down) ? 1 : 0);
      if (turn) { const a = turn * TURN * dt, c = Math.cos(a), s = Math.sin(a); setDir(R.dx * c - R.dy * s, R.dx * s + R.dy * c); }
      if (fwd) {
        const sp = fwd * MOVE * (player.charging ? 0.35 : 1) * dt;
        if (free(R.x + R.dx * sp, R.y)) R.x += R.dx * sp;
        if (free(R.x, R.y + R.dy * sp)) R.y += R.dy * sp;
        R.bob += dt * 11;
      }

      // charge: same rule as 2D — fills only while standing still (turning is fine)
      if (player.charging && !fwd) {
        state.charge = Math.min(state.chargeMax, state.charge + (L.chargeRate || 95) * dt);
        if (!R.wasFull && state.charge >= state.chargeMax) { R.wasFull = true; sfx.charge && sfx.charge(); }
      }
      if (state.charge < state.chargeMax) R.wasFull = false;

      // brush walls: getting shut on pushes you back to the last safe tile
      const tx = Math.floor(R.x), ty = Math.floor(R.y);
      if (cell(tx, ty) === "B") {
        if (brushClosed(tx, ty) > 0.5) { R.x = R.safe.x; R.y = R.safe.y; R.shake = 6; sfx.clank && sfx.clank(); say("Bristles! Wait for the gap."); }
      } else if (free(R.x, R.y)) { R.safe = { x: R.x, y: R.y }; }

      // toys
      for (const t of R.toys) if (!t.got && Math.hypot(t.x - R.x, t.y - R.y) < 0.5) {
        t.got = true; R.got++; host.addCharge ? host.addCharge(25) : (state.charge = Math.min(state.chargeMax, state.charge + 25));
        sfx.coin && sfx.coin(); say(["Your ball!", "Your other ball!", "Mr. Mouse!"][t.k] + "  (" + R.got + "/" + R.toys.length + ")");
      }

      // door opens when you walk up to it
      if (!R.doorOpen) {
        for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++)
          if (cell(x, y) === "D" && Math.hypot(x + 0.5 - R.x, y + 0.5 - R.y) < 1.25) { R.doorOpen = true; sfx.clank && sfx.clank(); say("The motor door creaks open..."); }
      } else if (R.doorT < 1) {
        R.doorT = Math.min(1, R.doorT + dt * 1.1);
      } else if (!R.cleared && cell(tx, ty) === "D") {
        R.cleared = true; host.onClear && host.onClear();
      }

      // motor hum grows with proximity
      if (R.motor) {
        startHum();
        const d = Math.hypot(R.motor.x - R.x, R.motor.y - R.y);
        if (R.hum) { R.hum.g.gain.value = clamp(0.06 / (1 + d * 0.6), 0, 0.06); R.hum.o.frequency.value = 55 + (state.charge / state.chargeMax) * 90; }
      }
    }
    function say(m, d = 2.2) { R.msg = m; R.msgT = d; }

    // called by game.js on Shift/C release (replaces tryPower in ray rooms)
    function release() {
      if (R.blast || state.charge < state.chargeMax) return false;
      state.charge = 0;
      if (R.motor) {
        const vx = R.motor.x - R.x, vy = R.motor.y - R.y, d = Math.hypot(vx, vy);
        if (d < 1.7 && (vx * R.dx + vy * R.dy) / d > 0.75) {
          R.blast = { t: 0, done: false }; R.flash = 0.8; sfx.thunder && sfx.thunder(); say("OVERLOAD!", 3); return true;
        }
        say("Get right up to the core, facing it."); R.flash = 0.25; sfx.thunder && sfx.thunder(); return true;
      }
      R.burst = 1.5; R.flash = 0.45; R.shake = 5; sfx.thunder && sfx.thunder();
      return true;
    }

    // ---------- lighting ----------
    let lightR = 14, ambient = 0;
    function light(d) {
      if (!L.dark) return 1 / (1 + d * 0.13);
      const b = 1 - d / lightR;
      return Math.max(ambient, b > 0 ? b * b * (3 - 2 * b) : 0);
    }
    function px(c, b, glow) {
      const f = th.fog;
      let r = f[0] + (c[0] - f[0]) * b, g = f[1] + (c[1] - f[1]) * b, bl = f[2] + (c[2] - f[2]) * b;
      if (glow) { r += glow * 30; g += glow * 70; bl += glow * 90; }
      return (255 << 24) | (clamp(bl, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255);
    }

    // ---------- wall textures (u: 0–1 across the face, z: 0–1 up the wall) ----------
    function wallTex(k, u, z, mx, my) {
      if (k === "#") {
        let c = null;
        if (th.key === "motor") {
          c = sample(hash(mx * 5 + 1, my * 3 + 2) < 0.8 ? "wall-rust" : "wall-metal", u, 1 - z);
        } else {
          const n = hash(mx * 7 + my * 13, mx * 3 + my * 5);
          c = sample(n < 0.45 ? "wall-metal" : n < 0.8 ? "wall-mold" : "wall-wet", u, 1 - z);
        }
        if (c) return c;
        const row = Math.floor(z * 6), uu = u * 3 + (row & 1) * 0.5;
        if (z * 6 - row < 0.1 || uu - Math.floor(uu) < 0.05) return th.mortar;
        return hash(mx * 7 + Math.floor(uu), row + my * 13) < 0.15 ? rgb.sage : th.wall;
      }
      if (k === "d") {
        const dc = sample("wall-mold", u, 1 - z);
        if (dc) return [Math.min(255, dc[0] * 1.15), Math.min(255, dc[1] * 1.15), Math.min(255, dc[2] * 1.15)];
        const n = hash(Math.floor(u * 14) + mx * 31, Math.floor(z * 10) + my * 17);
        return z > 0.9 - n * 0.25 ? rgb.pale : n < 0.33 ? rgb.mist : n < 0.66 ? rgb.fog : rgb.sage;
      }
      if (k === "D") {
        const dt = sample("door", u, 1 - z);
        if (dt) return dt;
        if (u < 0.06 || u > 0.94) return rgb.slate;
        const s = (u * 6 + z * 6) % 2;
        return z < 0.14 ? (s < 1 ? rgb.gold : rgb.ink) : (Math.floor(z * 8) % 3 === 0 ? rgb.sage : rgb.mist);
      }
      if (k === "E") {
        const vt = sample("vent", u, 1 - z);
        if (vt) return vt;
        const slat = (z * 12) % 1;
        return slat < 0.45 ? (Math.sin(R.t * 4 + z * 9) > 0.3 ? rgb.orange : rgb.coral) : rgb.slate;
      }
      if (k === "B") {
        const bristle = hash(Math.floor(u * 40), mx + my * 9);
        return z < 0.08 ? rgb.slate : bristle < 0.5 ? rgb.navy : bristle < 0.85 ? rgb.blue : rgb.azure;
      }
      return th.wall;
    }

    // ---------- render ----------
    function render(ctx) {
      const q = state.charge / state.chargeMax;
      lightR = 1.7 + 6.0 * q + (R.burst > 0 ? 18 * Math.min(1, R.burst / 0.4) : 0);
      ambient = L.dark ? 0.035 : 0;
      const glow = player.charging ? q * 0.6 : 0;
      const hor = HOR + (Math.sin(R.bob) * 1.5 | 0);
      const mp = R.motor ? 0.5 + 0.5 * Math.sin(R.t * 5) : 0;

      // ceiling + floor (per pixel, so the light circle shows on the floor)
      for (let y = 0; y < RH; y++) {
        const isFloor = y >= hor;
        const d = isFloor ? CAMZ * PROJ / (y - hor + 0.5) : (1 - CAMZ) * PROJ / (hor - y + 0.5);
        let fx = R.x + d * (R.dx - R.plx), fy = R.y + d * (R.dy - R.ply);
        const sx = d * 2 * R.plx / RW, sy = d * 2 * R.ply / RW;
        const row = y * RW;
        for (let x = 0; x < RW; x++, fx += sx, fy += sy) {
          const ex = fx - R.x, ey = fy - R.y, rd = Math.sqrt(ex * ex + ey * ey);
          let c, b = light(rd);
          if (isFloor) {
            const tx = Math.floor(fx), ty = Math.floor(fy), u = fx - tx, v = fy - ty;
            c = ((tx + ty) & 1) ? th.floorA : th.floorB;
            if (u < 0.05 || v < 0.05) c = th.line;
            else if (hash(Math.floor(fx * 8), Math.floor(fy * 8)) < 0.04) c = rgb.mist;   // lint specks
            if (R.motor) { const md = Math.hypot(fx - R.motor.x, fy - R.motor.y); if (md < 2.2) { b = Math.max(b, (1 - md / 2.2) * (0.6 + 0.4 * mp)); if (md < 1.4) c = rgb.copper; } }
          } else c = th.ceil;
          buf[row + x] = px(c, b, glow / (1 + rd));
        }
      }

      // walls: DDA continues through short tiles; draw far → near
      for (let x = 0; x < RW; x++) {
        const camX = 2 * x / RW - 1, rdx = R.dx + R.plx * camX, rdy = R.dy + R.ply * camX;
        let mx = Math.floor(R.x), my = Math.floor(R.y);
        const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx), ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
        const stx = rdx < 0 ? -1 : 1, sty = rdy < 0 ? -1 : 1;
        let sdx = rdx < 0 ? (R.x - mx) * ddx : (mx + 1 - R.x) * ddx;
        let sdy = rdy < 0 ? (R.y - my) * ddy : (my + 1 - R.y) * ddy;
        let n = 0; zbuf[x] = 1e9; shorts[x].length = 0;
        for (let i = 0; i < 64 && n < 16; i++) {
          let side;
          if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
          const h = tileH(mx, my); if (h <= 0) continue;
          const d = side === 0 ? sdx - ddx : sdy - ddy;
          let u = side === 0 ? R.y + d * rdy : R.x + d * rdx; u -= Math.floor(u);
          hitD[n] = d; hitH[n] = h; hitU[n] = u; hitS[n] = side; hitK[n] = cell(mx, my); hitX[n] = mx; hitY[n] = my; n++;
          if (h >= 1) { zbuf[x] = d; break; }
        }
        for (let k = n - 1; k >= 0; k--) {
          const d = Math.max(0.05, hitD[k]), h = hitH[k], kind = hitK[k];
          const yTop = hor - (h - CAMZ) * PROJ / d, yBot = hor + CAMZ * PROJ / d;
          if (h < 1) shorts[x].push({ d, yTop });
          const b = light(d) * (hitS[k] ? 0.75 : 1);
          const emissive = kind === "E" ? 0.8 : 0;
          const y0 = Math.max(0, Math.ceil(yTop)), y1 = Math.min(RH - 1, Math.floor(yBot));
          for (let y = y0; y <= y1; y++) {
            const z = CAMZ + (hor - y) * d / PROJ;
            buf[y * RW + x] = px(wallTex(kind, hitU[k], kind === "D" ? z + R.doorT * 0.92 : z / Math.max(h, 0.01), hitX[k], hitY[k]), Math.max(b, emissive), glow / (1 + d));
          }
        }
      }

      // sprites: toys + motor core, far → near
      const list = [];
      for (const t of R.toys) if (!t.got) list.push({ kind: "toy", o: t });
      if (R.motor) list.push({ kind: "motor", o: R.motor });
      const inv = 1 / (R.plx * R.dy - R.dx * R.ply);
      for (const s of list) {
        const sx = s.o.x - R.x, sy = s.o.y - R.y;
        s.tx = inv * (R.dy * sx - R.dx * sy); s.depth = inv * (-R.ply * sx + R.plx * sy);
      }
      list.sort((a, b) => b.depth - a.depth);
      for (const s of list) {
        if (s.depth < 0.15) continue;
        const scx = (RW / 2) * (1 + s.tx / s.depth);
        const isM = s.kind === "motor";
        const size = isM ? 0.75 : 0.22, z0 = isM ? 0 : 0.02 + 0.02 * Math.sin(R.t * 3 + s.o.k), z1 = z0 + (isM ? 0.85 : size);
        const half = size * PROJ / s.depth / 2;
        const xa = Math.max(0, Math.floor(scx - half)), xb = Math.min(RW - 1, Math.ceil(scx + half));
        const ya = hor - (z1 - CAMZ) * PROJ / s.depth, yb = hor - (z0 - CAMZ) * PROJ / s.depth;
        const b = isM ? 1 : Math.max(light(s.depth), 0.12);
        for (let x = xa; x <= xb; x++) {
          if (s.depth >= zbuf[x]) continue;
          const u = (x - (scx - half)) / (2 * half);
          for (let y = Math.max(0, Math.floor(ya)); y <= Math.min(RH - 1, Math.ceil(yb)); y++) {
            let hidden = false;
            for (const q2 of shorts[x]) if (q2.d < s.depth && y >= q2.yTop) { hidden = true; break; }
            if (hidden) continue;
            const v = (y - ya) / (yb - ya);
            let c = null;
            if (isM) {
              const mt = sample("motor", u, v);
              if (!mt) continue;
              buf[y * RW + x] = px(mt, 0.62 + 0.38 * mp, player.charging ? 0.3 * q : 0);
              continue;
            }
            const du = u - 0.5, dv = v - 0.5;
            if (s.o.k === 2) {                                   // mouse: grey body + pink ear
              if ((du * du) / 0.2 + (dv * dv) / 0.09 > 1) { if (Math.hypot(u - 0.75, v - 0.25) < 0.12) c = rgb.pink; else continue; }
              else c = Math.hypot(u - 0.3, v - 0.45) < 0.06 ? rgb.ink : rgb.fog;
            } else {                                             // ball
              if (du * du + dv * dv > 0.25) continue;
              c = TOY_COLS[s.o.k]; if (Math.hypot(u - 0.35, v - 0.32) < 0.12) c = rgb.white;
            }
            buf[y * RW + x] = px(c, b, 0);
          }
        }
        // sparkle so toys read in the dark
        if (!isM && Math.sin(R.t * 6 + s.o.k * 2) > 0.7 && s.depth < zbuf[clamp(scx | 0, 0, RW - 1)]) {
          const sy = Math.round(ya) - 2, sxp = Math.round(scx + half * 0.4);
          for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const X = sxp + ox, Y = sy + oy; if (X >= 0 && X < RW && Y >= 0 && Y < RH) buf[Y * RW + X] = px(rgb.white, 1, 0);
          }
        }
      }

      cx.putImageData(img, 0, 0);
      drawPaws(q, hor);

      // upscale 3× with shake
      const shx = R.shake ? Math.round((Math.random() * 2 - 1) * R.shake) : 0, shy = R.shake ? Math.round((Math.random() * 2 - 1) * R.shake) : 0;
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = AP.ink; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(cv, shx, shy, W, H);
      ctx.restore();
      drawHUD(ctx, q);
      if (R.flash > 0) { ctx.globalAlpha = Math.min(1, R.flash); ctx.fillStyle = AP.white; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }

    // paws + charge FX on the low-res layer (same layer logic as 2D: far sparks, paws, near sparks, arcs)
    function drawPaws(q, hor) {
      const c = cx, bob = Math.abs(Math.sin(R.bob)) * 3, charging = player.charging;
      const jit = charging && q > 0.6 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      const P = [{ x: 128 + jit, y: RH - 16 + bob }, { x: 192 - jit, y: RH - 13 + bob }];
      if (charging || R.burst > 0) {
        const k = Math.max(q, R.burst > 0 ? 1 : 0);
        const g = c.createRadialGradient(RW / 2, RH, 0, RW / 2, RH, 50 + 80 * k);
        g.addColorStop(0, `rgba(115,190,211,${0.25 + 0.35 * k})`); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g; c.fillRect(0, 0, RW, RH);
      }
      const sparks = [];
      if (charging && q > 0) {
        const n = q < 0.4 ? 1 : 5;
        for (let i = 0; i < n; i++) {
          const a = R.t * (4 + i * 0.7) + i * 6.283 / n, dep = Math.sin(a);
          sparks.push({ x: RW / 2 + Math.cos(a) * (70 + i * 4), y: RH - 26 + dep * 10, dep });
        }
      }
      const spark = (s) => { c.fillStyle = s.dep > 0 ? AP.white : AP.cyan; const r = s.dep > 0 ? 3 : 1; c.fillRect(Math.round(s.x) - (r >> 1), Math.round(s.y) - (r >> 1), r, r); };
      sparks.filter((s) => s.dep <= 0).forEach(spark);
      if (pawsImg && pawsAtlas) {
        const set = (charging && pawsAtlas.charge) ? pawsAtlas.charge : pawsAtlas.idle;
        const idx = charging ? Math.min(set.length - 1, Math.floor(q * set.length)) : ((R.t * 6 | 0) % set.length);
        const f = set[idx];
        c.imageSmoothingEnabled = false;
        // 84px filled 40% of the frame, so the paws read as glued to the lens.
        // Smaller + lower leaves floor in front of the cat and air above them.
        const PAW = 68, PAW_Y = RH - 56;
        c.drawImage(pawsImg, f.x, f.y, f.w, f.h,
          Math.round((RW - PAW) / 2) + jit, Math.round(PAW_Y + bob), PAW, PAW);
      } else {
        P.forEach((p, i) => {
          c.fillStyle = AP.ink; ell(c, p.x, p.y + 14, 25, 26);                         // black forearm
          c.fillStyle = AP.night; ell(c, p.x, p.y + 16, 23, 24);
          c.fillStyle = AP.ink; ell(c, p.x, p.y - 4, 21, 16);                          // white sock outline
          c.fillStyle = AP.white; ell(c, p.x, p.y - 4, 19, 14);
          c.fillStyle = AP.pale; ell(c, p.x + (i ? -6 : 6), p.y + 2, 10, 6);
          c.fillStyle = AP.pink;
          for (const [ox, oy] of [[-11, -12], [-4, -16], [4, -16], [11, -12]]) ell(c, p.x + ox, p.y + oy, 3, 2.5);
        });
      }
      sparks.filter((s) => s.dep > 0).forEach(spark);
      if (charging && q >= 0.4) {
        const n = q < 0.7 ? 1 : 3;
        for (let i = 0; i < n; i++) bolt(c, P[0].x + 8, P[0].y - 12 + rnd(-4, 4), P[1].x - 8, P[1].y - 12 + rnd(-4, 4), 7, 7);
        if (q >= 0.7) for (const p of P) { const a = rnd(-2.6, -0.5); bolt(c, p.x, p.y - 14, p.x + Math.cos(a) * 26, p.y - 14 + Math.sin(a) * 26, 4, 4); }
      }
      if (charging && q >= 1) { c.fillStyle = AP.white; c.fillRect(RW / 2 - 1, hor - 1, 2, 2); }
    }
    function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, 6.2832); c.fill(); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function bolt(c, x1, y1, x2, y2, jag, segs) {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pts = [[x1, y1]];
      for (let i = 1; i < segs; i++) { const f = i / segs, o = rnd(-jag, jag); pts.push([x1 + dx * f + nx * o, y1 + dy * f + ny * o]); }
      pts.push([x2, y2]);
      c.save(); c.lineCap = "round"; c.lineJoin = "round";
      for (const [w, col, a] of [[3, AP.cyan, 0.4], [1.5, AP.ice, 0.9], [1, AP.white, 1]]) {
        c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      }
      c.restore();
    }

    // full-res HUD (uses the game's pixel-font text() if the host provides it)
    function txt(ctx, s, x, y, size, col, align) {
      if (host.text) return host.text(s, x, y, size, col, align);
      ctx.font = `${size * 7}px monospace`; ctx.fillStyle = col; ctx.textAlign = align || "left"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
    }
    function drawHUD(ctx, q) {
      txt(ctx, (L.world ? L.world + "  " : "") + (L.name || ""), 24, 28, 2, AP.cream, "left");
      const bx = 24, by = 52, bw = 180;
      ctx.fillStyle = AP.ink; ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
      ctx.fillStyle = AP.slate; ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = q >= 1 ? AP.white : AP.cyan; ctx.fillRect(bx, by, Math.round(bw * q), 10);
      if (R.toys.length) txt(ctx, "TOYS " + R.got + "/" + R.toys.length, W - 24, 28, 2, AP.honey, "right");
      if (R.msgT > 0) { ctx.globalAlpha = Math.min(1, R.msgT * 2); txt(ctx, R.msg, W / 2, H - 120, 2, AP.honey, "center"); ctx.globalAlpha = 1; }
    }

    return {
      enter, exit, update, render, release,
      get state() { return R; },              // debug / tests
      assets: () => ({ tex: Object.keys(TEX).length, paws: !!(pawsImg && pawsAtlas) }),
      debugTeleport(x, y, dx, dy) { R.x = x; R.y = y; if (dx !== undefined) setDir(dx, dy); },
    };
  }

  window.CatRay = { create, RW, RH };
})();
