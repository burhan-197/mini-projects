/* ════════════════════════════════════════════════════════════
   NEON SERPENT — game engine
   Canvas renderer + fixed-timestep simulation with render
   interpolation, particles, screen shake, combos, golden
   apples, speed ramp and Web-Audio SFX. No dependencies.
   ════════════════════════════════════════════════════════════ */
(() => {
"use strict";

/* ─────────────────────────── DOM ─────────────────────────── */
const $ = (id) => document.getElementById(id);
const wrap        = $("boardWrap");
const canvas      = $("game");
const ctx         = canvas.getContext("2d");
const scoreEl     = $("score");
const bestEl      = $("best");
const timeEl      = $("time");
const speedEl     = $("speed");
const comboPill   = $("comboPill");
const comboMult   = $("comboMult");
const comboFill   = $("comboFill");
const startScreen = $("startScreen");
const overScreen  = $("gameOverScreen");
const pauseScreen = $("pauseScreen");
const goFlash     = $("goFlash");
const finalScore  = $("finalScore");
const finalBest   = $("finalBest");
const newBestBadge= $("newBestBadge");
const statLength  = $("statLength");
const statTime    = $("statTime");
const statCombo   = $("statCombo");
const statSpeed   = $("statSpeed");
const bestStart   = $("bestStart");
const btnStart    = $("btnStart");
const btnRestart  = $("btnRestart");
const btnResume   = $("btnResume");
const btnMute     = $("btnMute");
const btnPause    = $("btnPause");

/* ─────────────────────── tuning constants ────────────────── */
const COLS = 20, ROWS = 20;
const START_STEP = 150;      // ms per move at game start
const MIN_STEP   = 68;       // fastest the game ever gets
const STEP_DECAY = 2.6;      // ms faster per food eaten
const COMBO_WINDOW = 4200;   // ms to keep a combo alive
const MAX_COMBO  = 8;
const GOLDEN_CHANCE = 0.18;  // chance a golden apple spawns after a normal eat
const GOLDEN_LIFE   = 6000;  // ms before a golden apple vanishes
const DEATH_DELAY   = 950;   // ms of crash FX before the game-over panel

const DX = { up: -1, down: 1, left: 0, right: 0 };   // row delta (x = row)
const DY = { up: 0, down: 0, left: -1, right: 1 };   // col delta (y = col)
const OPP = { up: "down", down: "up", left: "right", right: "left" };

/* ─────────────────────────── audio ───────────────────────── */
let audioCtx = null;
let muted = localStorage.getItem("neonSerpentMuted") === "1";

function ac() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/** tiny synth blip: freq slide, envelope, done */
function tone(freq, dur, { type = "sine", vol = 0.14, delay = 0, slideTo = null } = {}) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const sfx = {
  click()  { tone(520, 0.07, { type: "triangle", vol: 0.1 }); },
  go()     { tone(392, 0.1, { type: "square", vol: 0.07 }); tone(784, 0.16, { type: "square", vol: 0.07, delay: 0.09 }); },
  eat(combo) {
    const base = 380 + combo * 70;
    tone(base, 0.09, { type: "square", vol: 0.06, slideTo: base * 1.6 });
    tone(base * 2, 0.12, { type: "sine", vol: 0.1, delay: 0.04 });
  },
  golden() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.14, { type: "triangle", vol: 0.12, delay: i * 0.06 }));
  },
  die() {
    tone(220, 0.5, { type: "sawtooth", vol: 0.12, slideTo: 55 });
    tone(110, 0.6, { type: "square", vol: 0.06, delay: 0.08, slideTo: 40 });
  },
  pause()  { tone(330, 0.08, { type: "sine", vol: 0.08 }); },
};

function updateMuteIcon() { btnMute.textContent = muted ? "🔇" : "🔊"; }
function toggleMute() {
  muted = !muted;
  localStorage.setItem("neonSerpentMuted", muted ? "1" : "0");
  updateMuteIcon();
  if (!muted) sfx.click();
}

/* ─────────────────────── game state ──────────────────────── */
let snake, prevSnake, dir, dirQueue;
let food, golden;
let score, best, bestAtStart, combo, maxCombo, lastEatAt;
let foods, stepMs, minStep;
let running, paused, dead, overShown;
let acc, lastT, alpha;
let particles, floaters;
let shake, flashA, deathT;
let startedAt, pausedTotal, pauseBegan, lastShownSec;
let cssSize, cell, bgCanvas;

best = parseInt(localStorage.getItem("neonSerpentBest") || "0", 10) || 0;

function resetState() {
  snake     = [{ x: 4, y: 9 }, { x: 4, y: 8 }, { x: 4, y: 7 }];
  prevSnake = snake.map((s) => ({ ...s }));
  dir = "right";
  dirQueue = [];
  food = null;
  golden = null;
  score = 0; combo = 1; maxCombo = 1; lastEatAt = 0;
  foods = 0;
  stepMs = START_STEP; minStep = START_STEP;
  running = false; paused = false; dead = false; overShown = false;
  acc = 0; alpha = 1;
  particles = []; floaters = [];
  shake = 0; flashA = 0; deathT = 0;
  startedAt = 0; pausedTotal = 0; pauseBegan = 0; lastShownSec = -1;
  food = spawnFreeCell();
}

/* ─────────────────── canvas sizing / bg ──────────────────── */
function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssSize = Math.floor(wrap.clientWidth);
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cell = cssSize / COLS;
  buildBackground(dpr);
}

function buildBackground(dpr) {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = cssSize * dpr;
  bgCanvas.height = cssSize * dpr;
  const b = bgCanvas.getContext("2d");
  b.setTransform(dpr, 0, 0, dpr, 0, 0);

  b.fillStyle = "#070b16";
  b.fillRect(0, 0, cssSize, cssSize);

  // subtle checker
  b.fillStyle = "rgba(255,255,255,0.018)";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if ((r + c) % 2 === 0) b.fillRect(c * cell, r * cell, cell, cell);

  // soft center glow
  const glow = b.createRadialGradient(
    cssSize / 2, cssSize / 2, cssSize * 0.1,
    cssSize / 2, cssSize / 2, cssSize * 0.75
  );
  glow.addColorStop(0, "rgba(163,230,53,0.055)");
  glow.addColorStop(1, "rgba(163,230,53,0)");
  b.fillStyle = glow;
  b.fillRect(0, 0, cssSize, cssSize);

  // vignette
  const vig = b.createRadialGradient(
    cssSize / 2, cssSize / 2, cssSize * 0.42,
    cssSize / 2, cssSize / 2, cssSize * 0.78
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.5)");
  b.fillStyle = vig;
  b.fillRect(0, 0, cssSize, cssSize);
}

/* ─────────────────────── spawning ────────────────────────── */
function spawnFreeCell() {
  const taken = new Set(snake.map((s) => s.x + "," + s.y));
  if (food) taken.add(food.x + "," + food.y);
  if (golden) taken.add(golden.x + "," + golden.y);
  const free = [];
  for (let x = 0; x < ROWS; x++)
    for (let y = 0; y < COLS; y++)
      if (!taken.has(x + "," + y)) free.push({ x, y });
  if (!free.length) return null;
  return free[(Math.random() * free.length) | 0];
}

/* ─────────────────────── fx helpers ──────────────────────── */
function burst(px, py, colors, n, speed, life) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.85);
    particles.push({
      x: px, y: py,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.25,
      life: life * (0.6 + Math.random() * 0.6), maxLife: life,
      color: colors[(Math.random() * colors.length) | 0],
      size: cell * (0.06 + Math.random() * 0.1),
      grav: speed * 1.6,
    });
  }
}

function floater(px, py, text, color) {
  floaters.push({ x: px, y: py, text, color, life: 900, maxLife: 900 });
}

function cellCenter(p) {
  return { x: (p.y + 0.5) * cell, y: (p.x + 0.5) * cell };
}

function lerpColor(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
const HEAD_RGB = [190, 242, 100];
const TAIL_RGB = [21, 128, 61];

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* ─────────────────────── HUD ─────────────────────────────── */
function setScore(v) {
  scoreEl.textContent = v;
  scoreEl.classList.remove("pop");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("pop");
}
function refreshHudStatic() {
  bestEl.textContent = best;
  bestStart.textContent = best;
  speedEl.textContent = "×" + (START_STEP / stepMs).toFixed(1);
}

/* ─────────────────── game flow ───────────────────────────── */
function startGame() {
  ac(); // unlock audio on the user gesture
  resetState();
  running = true;
  startedAt = performance.now();
  bestAtStart = best;
  lastT = startedAt;
  startScreen.classList.add("hidden");
  overScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  setScore(0);
  refreshHudStatic();
  timeEl.textContent = "00:00";
  goFlash.classList.remove("hidden");
  // retrigger the GO! animation
  goFlash.style.animation = "none";
  void goFlash.offsetWidth;
  goFlash.style.animation = "";
  setTimeout(() => goFlash.classList.add("hidden"), 750);
  sfx.go();
}

function die() {
  if (dead) return;
  dead = true;
  deathT = 0;
  shake = 16;
  flashA = 0.55;
  sfx.die();
  const hp = cellCenter(snake[0]);
  burst(hp.x, hp.y, ["#a3e635", "#4ade80", "#f43f5e", "#ffffff"], 42, cell * 9, 900);

  const isBest = score > bestAtStart;
  if (score > best) {
    best = score;
    localStorage.setItem("neonSerpentBest", String(best));
  }
  if (isBest) {
    // confetti celebration
    for (let i = 0; i < 5; i++)
      setTimeout(() => burst(
        Math.random() * cssSize, cssSize * 0.25,
        ["#fbbf24", "#a3e635", "#22d3ee", "#fb7185", "#ffffff"],
        22, cell * 7, 1400
      ), i * 130);
  }
  newBestBadge.classList.toggle("hidden", !isBest);
  finalScore.textContent = score;
  finalBest.textContent = best;
  statLength.textContent = snake.length;
  statTime.textContent = formatTime(performance.now() - startedAt - pausedTotal);
  statCombo.textContent = "×" + maxCombo;
  statSpeed.textContent = "×" + (START_STEP / minStep).toFixed(1);
  bestEl.textContent = best;
  bestStart.textContent = best;
}

function togglePause(force) {
  if (!running || dead) return;
  const next = force !== undefined ? force : !paused;
  if (next === paused) return;
  paused = next;
  if (paused) {
    pauseBegan = performance.now();
    pauseScreen.classList.remove("hidden");
    sfx.pause();
  } else {
    pausedTotal += performance.now() - pauseBegan;
    lastT = performance.now();
    acc = 0; // fresh full step on resume — no "banked" partial step firing instantly
    pauseScreen.classList.add("hidden");
    sfx.click();
  }
}

/* ─────────────────── simulation step ─────────────────────── */
function doStep() {
  prevSnake = snake.map((s) => ({ ...s }));
  if (dirQueue.length) dir = dirQueue.shift();

  const h = snake[0];
  const nh = { x: h.x + DX[dir], y: h.y + DY[dir] };

  // wall collision
  if (nh.x < 0 || nh.x >= ROWS || nh.y < 0 || nh.y >= COLS) { die(); return; }

  const ateFood  = food   && nh.x === food.x   && nh.y === food.y;
  const ateGold  = golden && nh.x === golden.x && nh.y === golden.y;
  const growing  = ateFood || ateGold;

  // self collision (tail cell is free unless we're growing into it)
  const body = growing ? snake : snake.slice(0, -1);
  for (const s of body) {
    if (s.x === nh.x && s.y === nh.y) { die(); return; }
  }

  snake.unshift(nh);
  if (growing) {
    prevSnake.push({ ...prevSnake[prevSnake.length - 1] }); // keep interp lengths equal
    onEat(nh, ateGold);
  } else {
    snake.pop();
  }
}

function onEat(pos, isGold) {
  foods++;
  const now = performance.now();
  // lastEatAt starts at 0 (never eaten) — the > 0 guard keeps the first
  // eat at combo x1 even if the game starts within COMBO_WINDOW of page load
  combo = (lastEatAt > 0 && now - lastEatAt <= COMBO_WINDOW) ? Math.min(combo + 1, MAX_COMBO) : 1;
  maxCombo = Math.max(maxCombo, combo);
  lastEatAt = now;

  const pts = (isGold ? 25 : 10) * combo;
  score += pts;
  setScore(score);

  stepMs = Math.max(MIN_STEP, START_STEP - foods * STEP_DECAY);
  minStep = Math.min(minStep, stepMs);
  speedEl.textContent = "×" + (START_STEP / stepMs).toFixed(1);

  const c = cellCenter(pos);
  if (isGold) {
    sfx.golden();
    burst(c.x, c.y, ["#fbbf24", "#fde68a", "#ffffff"], 30, cell * 8, 800);
    floater(c.x, c.y - cell * 0.4, "+" + pts, "#fbbf24");
    golden = null;
    food = spawnFreeCell();
  } else {
    sfx.eat(combo);
    burst(c.x, c.y, ["#fb7185", "#f43f5e", "#fecdd3"], 16, cell * 6, 600);
    floater(c.x, c.y - cell * 0.4, "+" + pts, combo > 1 ? "#fbbf24" : "#eaf0fa");
    food = spawnFreeCell();
    if (!golden && Math.random() < GOLDEN_CHANCE) {
      const g = spawnFreeCell();
      if (g) golden = { ...g, expires: now + GOLDEN_LIFE };
    }
  }
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem("neonSerpentBest", String(best));
  }
}

function queueDir(d) {
  if (!running || paused || dead) return;
  const lastQ = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
  if (d === lastQ || OPP[d] === lastQ) return;
  if (dirQueue.length < 3) dirQueue.push(d);
}

/* ─────────────────────── rendering ───────────────────────── */
function interpPoints() {
  const pts = [];
  const n = snake.length;
  for (let i = 0; i < n; i++) {
    const cur = snake[i];
    const prv = prevSnake[Math.min(i, prevSnake.length - 1)];
    const gx = prv.x + (cur.x - prv.x) * alpha;
    const gy = prv.y + (cur.y - prv.y) * alpha;
    pts.push({ x: (gy + 0.5) * cell, y: (gx + 0.5) * cell });
  }
  return pts;
}

function drawSnake() {
  const pts = interpPoints();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // body: tail → head, lerped color + tapering width, neon glow
  ctx.shadowColor = "rgba(163,230,53,0.5)";
  ctx.shadowBlur = 16;
  for (let i = pts.length - 1; i >= 1; i--) {
    const t = i / Math.max(pts.length - 1, 1); // 0 at head → 1 at tail
    ctx.strokeStyle = lerpColor(HEAD_RGB, TAIL_RGB, t);
    ctx.lineWidth = cell * (0.74 - 0.26 * t);
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // head
  const hp = pts[0];
  const g = ctx.createRadialGradient(
    hp.x - cell * 0.14, hp.y - cell * 0.14, cell * 0.08,
    hp.x, hp.y, cell * 0.52
  );
  g.addColorStop(0, "#ecfccb");
  g.addColorStop(0.55, "#a3e635");
  g.addColorStop(1, "#4d7c0f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, cell * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // eyes look toward travel direction (screen space: x=col, y=row)
  const sdx = DY[dir], sdy = DX[dir];
  const ex = -sdy, ey = sdx; // perpendicular
  for (const s of [-1, 1]) {
    const cxp = hp.x + sdx * cell * 0.16 + ex * s * cell * 0.2;
    const cyp = hp.y + sdy * cell * 0.16 + ey * s * cell * 0.2;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cxp, cyp, cell * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b1220";
    ctx.beginPath(); ctx.arc(cxp + sdx * cell * 0.05, cyp + sdy * cell * 0.05, cell * 0.065, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFood(now) {
  if (!food) return;
  const c = cellCenter(food);
  const pulse = 1 + 0.13 * Math.sin(now / 170);
  const r = cell * 0.32 * pulse;
  ctx.shadowColor = "rgba(244,63,94,0.85)";
  ctx.shadowBlur = 18;
  const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.15, c.x, c.y, r);
  g.addColorStop(0, "#fecdd3");
  g.addColorStop(0.45, "#fb7185");
  g.addColorStop(1, "#be123c");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // glossy highlight
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath(); ctx.arc(c.x - r * 0.32, c.y - r * 0.36, r * 0.2, 0, Math.PI * 2); ctx.fill();
}

function drawGolden(now) {
  if (!golden) return;
  if (now > golden.expires) { golden = null; return; }
  const c = cellCenter(golden);
  const pulse = 1 + 0.16 * Math.sin(now / 130);
  const r = cell * 0.36 * pulse;
  ctx.shadowColor = "rgba(251,191,36,0.9)";
  ctx.shadowBlur = 22;
  const g = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.15, c.x, c.y, r);
  g.addColorStop(0, "#fef9c3");
  g.addColorStop(0.45, "#fbbf24");
  g.addColorStop(1, "#b45309");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // countdown ring
  const frac = Math.max(0, (golden.expires - now) / GOLDEN_LIFE);
  ctx.strokeStyle = frac < 0.3 ? "#f43f5e" : "#fbbf24";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.x, c.y, cell * 0.58, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
}

function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt / 1000;
    p.y += p.vy * dt / 1000;
    p.vy += p.grav * dt / 1000;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y -= cell * 1.4 * dt / 1000;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  if (shake > 0) shake = Math.max(0, shake - dt * 0.028);
  if (flashA > 0) flashA = Math.max(0, flashA - dt * 0.0011);
}

function drawFx() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.font = `800 ${Math.round(cell * 0.62)}px Orbitron, sans-serif`;
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 10;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function render(now) {
  ctx.clearRect(0, 0, cssSize, cssSize);
  ctx.drawImage(bgCanvas, 0, 0, cssSize, cssSize);

  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
  drawFood(now);
  drawGolden(now);
  if (snake) drawSnake();
  drawFx();
  ctx.restore();

  if (flashA > 0) {
    ctx.fillStyle = `rgba(244,63,94,${flashA.toFixed(3)})`;
    ctx.fillRect(0, 0, cssSize, cssSize);
  }
}

/* ─────────────────────── main loop ───────────────────────── */
function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - lastT;
  if (dt > 250) dt = 250; // tab was hidden — don't spiral
  lastT = now;

  if (running && !paused && !dead) {
    acc += dt;
    let guard = 0;
    const step = stepMs; // frozen for this frame — doStep may change stepMs on eat
    while (acc >= step && guard < 6 && !dead) {
      doStep();
      acc -= step;
      guard++;
    }
    alpha = dead ? 1 : Math.min(acc / stepMs, 1);

    // HUD: combo pill + clock
    if (combo >= 2) {
      const remain = Math.max(0, COMBO_WINDOW - (now - lastEatAt));
      if (remain > 0) {
        comboPill.classList.remove("hidden");
        comboMult.textContent = "×" + combo;
        comboFill.style.width = (remain / COMBO_WINDOW * 100).toFixed(1) + "%";
      } else {
        comboPill.classList.add("hidden");
        combo = 1;
      }
    } else {
      comboPill.classList.add("hidden");
    }
    const elapsed = now - startedAt - pausedTotal;
    const sec = Math.floor(elapsed / 1000);
    if (sec !== lastShownSec) {
      lastShownSec = sec;
      timeEl.textContent = formatTime(elapsed);
    }
  } else if (dead && !overShown) {
    deathT += dt;
    if (deathT >= DEATH_DELAY) {
      overShown = true;
      overScreen.classList.remove("hidden");
    }
  }

  updateFx(dt);
  render(now);
}

/* ─────────────────────── input ───────────────────────────── */
const KEYMAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

document.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  const d = KEYMAP[e.code];
  if (d) { queueDir(d); return; }
  if (e.code === "Space") {
    if (!startScreen.classList.contains("hidden")) startGame();
    else if (!overScreen.classList.contains("hidden")) startGame();
    else togglePause();
  } else if (e.code === "KeyP" || e.code === "Escape") {
    togglePause();
  } else if (e.code === "KeyM") {
    toggleMute();
  }
});

// swipe controls for touch
let touchX = 0, touchY = 0;
wrap.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchX = t.clientX; touchY = t.clientY;
}, { passive: true });
wrap.addEventListener("touchend", (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchX;
  const dy = t.clientY - touchY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  queueDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
}, { passive: true });

btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", startGame);
btnResume.addEventListener("click", () => togglePause(false));
btnMute.addEventListener("click", toggleMute);
btnPause.addEventListener("click", () => togglePause());
pauseScreen.addEventListener("click", () => togglePause(false));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) togglePause(true);
});

/* ─────────────────────── boot ────────────────────────────── */
let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(fit, 120);
});

updateMuteIcon();
resetState();
refreshHudStatic();
requestAnimationFrame(() => {
  fit();
  lastT = performance.now();
  requestAnimationFrame(frame);
});

})();
