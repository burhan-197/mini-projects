/* ═══════════════════════════════════════════════════════════
   STARFALL — game engine
   Canvas shooter: fixed pools, pre-rendered sprites, dt-based sim.
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ── utils ─────────────────────────────────────────────── */
const TAU = Math.PI * 2;
let R = Math.random; // gameplay RNG
const rand = (a, b) => a + R() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── safe storage (never throws, private-mode safe) ────── */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

/* ── dom ───────────────────────────────────────────────── */
const canvas = $("game");
const ctx = canvas.getContext("2d");
const scoreEl = $("score"), bestEl = $("best"), livesEl = $("lives");
const waveEl = $("wave"), waveFill = $("waveFill");
const bossBar = $("bossBar"), bossFill = $("bossFill"), bossNameEl = $("bossName");
const banner = $("banner"), bannerTitle = $("bannerTitle"), bannerSub = $("bannerSub");
const healthWrap = $("healthWrap"), healthFill = $("healthFill");
const hud = $("hud"), fireBtn = $("fireBtn"), bombBtn = $("bombBtn");
const chipsEl = $("chips"), wpipsEl = $("wpips");
const startScreen = $("startScreen"), pauseScreen = $("pauseScreen"), overScreen = $("gameOverScreen");
const btnStart = $("btnStart"), btnRestart = $("btnRestart"), btnResume = $("btnResume");
const btnRestartP = $("btnRestartP"), btnQuit = $("btnQuit");
const btnMute = $("btnMute"), btnPause = $("btnPause");
const volSlider = $("volSlider"), motionChk = $("motionChk");

/* ── viewport (css px; ctx scaled by dpr) ───────────────── */
let W = 0, H = 0, DPR = 1;
let nebulaCv = null, vigCv = null;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildBackdrops();
  initStars();
  player.x = clamp(player.x || W / 2, 24, W - 24);
  player.y = clamp(player.y || H - 110, H * 0.3, H - 60);
}

/* ── audio (all synthesized, no files) ─────────────────── */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let AC = null, master = null, musicGain = null;
let muted = store.get("sfMuted", "0") === "1";
let volume = parseFloat(store.get("sfVol", "1")) || 1;
let reduceMotion = store.get("sfMotion", "0") === "1";

function initAudio() {
  if (AC || !AudioCtx) return;
  try {
    AC = new AudioCtx();
    master = AC.createGain();
    master.gain.value = muted ? 0 : 0.28 * volume;
    master.connect(AC.destination);
    musicGain = AC.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
  } catch (e) { AC = null; }
}
function tone(freq, dur, type, vol, slideTo, dest) {
  if (!AC || muted) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol || 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, q, dest) {
  if (!AC || muted) return;
  const n = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "bandpass";
  f.frequency.value = freq || 1000; f.Q.value = q || 1;
  const g = AC.createGain();
  const t = AC.currentTime;
  g.gain.setValueAtTime(vol || 0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || master);
  src.start(t);
}
const sfx = {
  shoot()      { tone(880, 0.07, "square", 0.05); tone(1320, 0.05, "sawtooth", 0.03); },
  shootUp()    { tone(1050, 0.05, "square", 0.05); tone(1600, 0.04, "sawtooth", 0.03); },
  laser()      { tone(180, 0.16, "sawtooth", 0.07, 1400); },
  hit()        { tone(320, 0.08, "square", 0.09); noise(0.05, 0.05, 2200); },
  kill(streak) { const p = 300 + Math.min(streak, 24) * 22; tone(p, 0.09, "square", 0.055, p * 1.6); },
  boomS()      { noise(0.25, 0.13, 900); tone(160, 0.18, "sawtooth", 0.09, 60); },
  boomB()      { noise(0.55, 0.18, 480); tone(90, 0.45, "sawtooth", 0.13, 35); },
  bomb()       { noise(0.9, 0.22, 300); tone(70, 0.8, "sawtooth", 0.16, 30); tone(1200, 0.3, "sine", 0.08, 200); },
  hurt()       { noise(0.2, 0.14, 1400); tone(220, 0.16, "square", 0.11, 90); },
  power()      { if (!AC || muted) return; const t = AC.currentTime;
                 [440, 660, 990].forEach((f, i) => setTimeout(() => tone(f, 0.12, "sine", 0.1), i * 70)); },
  life()       { if (!AC || muted) return; [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.14, "sine", 0.09), i * 80)); },
  graze()      { tone(2400, 0.05, "sine", 0.06, 3200); },
  comboUp(m)   { tone(500 + m * 90, 0.09, "triangle", 0.09, 900 + m * 120); },
  eshoot()     { tone(210, 0.09, "sawtooth", 0.035, 140); },
  warn()       { if (!AC || muted) return; for (let i = 0; i < 3; i++) setTimeout(() => { tone(110, 0.22, "sawtooth", 0.12, 70); }, i * 280); },
  waveClear()  { if (!AC || muted) return; [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.18, "sine", 0.08), i * 90)); },
  over()       { if (!AC || muted) return; [400, 340, 280, 180].forEach((f, i) => setTimeout(() => tone(f, 0.28, "sawtooth", 0.1, f * 0.7), i * 160)); },
  start()      { if (!AC || muted) return; [262, 392, 523, 784].forEach((f, i) => setTimeout(() => tone(f, 0.12, "square", 0.07), i * 70)); },
  pause()      { tone(500, 0.08, "sine", 0.07, 300); },
  click()      { tone(700, 0.05, "sine", 0.06); },
};

/* ── adaptive procedural music: intensity follows combo + boss ── */
const music = { step: 0 };
const BASSLINE = [55, 55, 65.41, 55, 49, 49, 58.27, 73.42]; // A F G-ish movement
const ARPNOTES = [220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63];
function musicStep() {
  if (!AC || muted || !S.running || S.paused) return;
  const inten = clamp(S.mult / 8 * 0.45 + (S.boss ? 0.45 : 0) + Math.min(0.22, S.wave * 0.014), 0.1, 1);
  const st = music.step % 16;
  const bar = Math.floor(music.step / 16) % BASSLINE.length;
  // bass pulse every 4 steps
  if (st % 4 === 0) tone(BASSLINE[bar], 0.5, "triangle", 0.05 + inten * 0.03, BASSLINE[bar] * 0.99, musicGain);
  // hats on off-beats once things heat up
  if (inten > 0.35 && st % 2 === 1) noise(0.03, 0.018, 8000, 2, musicGain);
  // arp when combo is rolling
  if (inten > 0.6 && st % 2 === 0) {
    const n = ARPNOTES[(st / 2 + bar * 3) % ARPNOTES.length | 0];
    tone(n, 0.16, "sine", 0.028, undefined, musicGain);
  }
  // boss lead: urgent octave stabs
  if (S.boss && st % 8 === 6) {
    const n = ARPNOTES[(bar * 5 + 2) % ARPNOTES.length | 0] * 2;
    tone(n, 0.22, "square", 0.03, n * 0.97, musicGain);
  }
  music.step++;
}
setInterval(musicStep, 190);

/* ── haptics + wake lock (guarded) ─────────────────────── */
function buzz(p) {
  try { const n = typeof navigator !== "undefined" ? navigator : null; if (n && n.vibrate) n.vibrate(p); } catch (e) {}
}
let wakeLock = null;
async function lockScreen() {
  try {
    const n = typeof navigator !== "undefined" ? navigator : null;
    if (n && "wakeLock" in n && !wakeLock) {
      wakeLock = await n.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch (e) {}
}
function unlockScreen() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }

/* ── sprites (pre-rendered once; blitted per frame) ────── */
const SS = 2; // supersample for crispness
function makeSprite(w, h, drawFn, flash) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * SS); c.height = Math.ceil(h * SS);
  const g = c.getContext("2d");
  g.scale(SS, SS); g.translate(w / 2, h / 2);
  drawFn(g);
  if (flash) {
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(-w / 2, -h / 2, w, h);
  }
  return { c, w, h };
}
function blit(s, x, y, rot) {
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h); ctx.restore(); }
  else ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h);
}
function blitS(s, x, y, sc, rot) { // scaled blit (mini-bosses)
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
  ctx.restore();
}
function glowSprite(size, color, core) {
  return makeSprite(size, size, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    gr.addColorStop(0, core || "#ffffff");
    gr.addColorStop(0.35, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(-size / 2, -size / 2, size, size);
  });
}

const SPR = {};
function buildSprites() {
  // player ship (faces up)
  const ship = (g) => {
    const eg = g.createRadialGradient(0, 26, 2, 0, 34, 22);
    eg.addColorStop(0, "rgba(0,210,255,0.85)");
    eg.addColorStop(0.5, "rgba(0,110,255,0.3)");
    eg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = eg; g.fillRect(-13, 18, 26, 34);
    g.fillStyle = "#16233d"; g.strokeStyle = "#22d3ee"; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -26); g.lineTo(-20, 18); g.lineTo(-14, 26); g.lineTo(-5, 20);
    g.lineTo(5, 20); g.lineTo(14, 26); g.lineTo(20, 18); g.lineTo(0, -26);
    g.closePath(); g.fill(); g.stroke();
    const cg = g.createLinearGradient(0, -16, 0, 6);
    cg.addColorStop(0, "#a5f3fc"); cg.addColorStop(1, "#0369a1");
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(0, -5, 6, 12, 0, 0, TAU); g.fill();
    g.strokeStyle = "#f0f"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-8, 4); g.lineTo(-18, 18); g.moveTo(8, 4); g.lineTo(18, 18); g.stroke();
  };
  SPR.player = makeSprite(46, 58, ship);

  // enemies (face down)
  SPR.basic = makeSprite(40, 34, (g) => {
    g.fillStyle = "#2a0a3a"; g.strokeStyle = "#f0f"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 15); g.lineTo(-18, -10); g.lineTo(-8, -15); g.lineTo(8, -15); g.lineTo(18, -10);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#f87171"; g.beginPath(); g.arc(0, 0, 4.5, 0, TAU); g.fill();
  });
  SPR.fast = makeSprite(48, 26, (g) => {
    g.fillStyle = "#0a2a1a"; g.strokeStyle = "#a3e635"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(-22, -8); g.lineTo(0, -3); g.lineTo(22, -8);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#a3e635"; g.beginPath(); g.arc(0, 2, 3.2, 0, TAU); g.fill();
  });
  SPR.tank = makeSprite(46, 46, (g) => {
    g.fillStyle = "#2a1a0a"; g.strokeStyle = "#fb923c"; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = "#fde68a"; g.lineWidth = 1.4;
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.stroke();
    g.fillStyle = "#f87171"; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
  });
  SPR.diver = makeSprite(34, 34, (g) => {
    g.fillStyle = "#3a0a2a"; g.strokeStyle = "#fb7185"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(-14, -6); g.lineTo(0, -14); g.lineTo(14, -6);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#fb7185"; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill();
  });
  SPR.sniper = makeSprite(38, 30, (g) => {
    g.fillStyle = "#0a1a3a"; g.strokeStyle = "#7dd3fc"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 14); g.lineTo(-17, -8); g.lineTo(-6, -12); g.lineTo(6, -12); g.lineTo(17, -8);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#7dd3fc"; g.fillRect(-2, -2, 4, 12);
  });
  // splitter: cracked orange diamond — bursts into 2 fasts
  SPR.splitter = makeSprite(40, 40, (g) => {
    g.fillStyle = "#2a1503"; g.strokeStyle = "#fdba74"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, -18); g.lineTo(16, 0); g.lineTo(0, 18); g.lineTo(-16, 0);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#fff7ed"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-8, -10); g.lineTo(2, -2); g.lineTo(-4, 8); g.moveTo(6, -12); g.lineTo(10, 2); g.stroke();
    g.fillStyle = "#fdba74"; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
  });
  // mine-layer: wide purple barge
  SPR.minelayer = makeSprite(56, 30, (g) => {
    g.fillStyle = "#1c0f2e"; g.strokeStyle = "#c084fc"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-26, -6); g.lineTo(26, -6); g.lineTo(18, 12); g.lineTo(-18, 12);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#c084fc";
    for (const px of [-14, 0, 14]) { g.beginPath(); g.arc(px, 0, 3.6, 0, TAU); g.fill(); }
  });
  // mine: pulsing spiked orb
  SPR.mine = makeSprite(30, 30, (g) => {
    g.strokeStyle = "#f87171"; g.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
      g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
      g.stroke();
    }
    const mg = g.createRadialGradient(0, 0, 1, 0, 0, 8);
    mg.addColorStop(0, "#fff"); mg.addColorStop(0.5, "#f87171"); mg.addColorStop(1, "#7f1d1d");
    g.fillStyle = mg; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
  });
  // ── bosses: three visually distinct dreadnoughts ──
  // WARDEN — hexagonal fortress (wave 3): heavy, red
  SPR.bossWarden = makeSprite(140, 110, (g) => {
    g.fillStyle = "#20060a"; g.strokeStyle = "#f87171"; g.lineWidth = 3.5;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU - Math.PI / 2;
      const px = Math.cos(a) * 52, py = Math.sin(a) * 44;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#fca5a5"; g.lineWidth = 1.6;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU - Math.PI / 2 + 0.3;
      const px = Math.cos(a) * 30, py = Math.sin(a) * 25;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.stroke();
    g.fillStyle = "#f87171";
    g.beginPath(); g.arc(-18, 6, 7, 0, TAU); g.arc(18, 6, 7, 0, TAU); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(-18, 6, 2.8, 0, TAU); g.arc(18, 6, 2.8, 0, TAU); g.fill();
    g.fillStyle = "#7f1d1d"; g.fillRect(-4, 34, 8, 14);
  });
  // LANCER — sleek strike dart (wave 6): fast, purple
  SPR.bossLancer = makeSprite(120, 100, (g) => {
    g.fillStyle = "#150a2e"; g.strokeStyle = "#c084fc"; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 46); g.lineTo(-16, 6); g.lineTo(-44, -18); g.lineTo(-18, -10);
    g.lineTo(-10, -38); g.lineTo(0, -20); g.lineTo(10, -38); g.lineTo(18, -10);
    g.lineTo(44, -18); g.lineTo(16, 6);
    g.closePath(); g.fill(); g.stroke();
    const cg = g.createLinearGradient(0, -30, 0, 30);
    cg.addColorStop(0, "#e9d5ff"); cg.addColorStop(1, "#7c3aed");
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(0, 2, 6, 20, 0, 0, TAU); g.fill();
    g.strokeStyle = "#e9d5ff"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-30, -8); g.lineTo(-12, 4); g.moveTo(30, -8); g.lineTo(12, 4); g.stroke();
  });
  // HIVE — pod carrier (wave 9): spawner, green
  SPR.bossHive = makeSprite(150, 120, (g) => {
    g.fillStyle = "#06240f"; g.strokeStyle = "#4ade80"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, 58, 40, 0, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = "#bbf7d0"; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 36, 24, 0, 0, TAU); g.stroke();
    for (const [px, py] of [[-44, -22], [44, -22], [-44, 22], [44, 22]]) {
      const pg = g.createRadialGradient(px, py, 1, px, py, 15);
      pg.addColorStop(0, "#ecfdf5"); pg.addColorStop(0.5, "#4ade80"); pg.addColorStop(1, "rgba(74,222,128,0)");
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, 15, 0, TAU); g.fill();
      g.strokeStyle = "#4ade80"; g.lineWidth = 2;
      g.beginPath(); g.arc(px, py, 9, 0, TAU); g.stroke();
    }
    g.fillStyle = "#166534"; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
    g.fillStyle = "#bbf7d0"; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
  });
  // white hit-flash copies
  for (const k of ["basic", "fast", "tank", "diver", "sniper", "splitter", "minelayer", "mine",
                   "bossWarden", "bossLancer", "bossHive"]) {
    SPR[k + "F"] = makeSprite(SPR[k].w, SPR[k].h, (g) => {
      g.drawImage(SPR[k].c, -SPR[k].w / 2, -SPR[k].h / 2, SPR[k].w, SPR[k].h);
    }, true);
  }
  // player bullets
  SPR.bullet = makeSprite(10, 26, (g) => {
    const gr = g.createLinearGradient(0, -13, 0, 13);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.4, "#22d3ee"); gr.addColorStop(1, "rgba(34,211,238,0)");
    g.fillStyle = gr; g.fillRect(-2.5, -13, 5, 26);
  });
  SPR.laser = makeSprite(16, 40, (g) => { // overcharge piercing beam bolt
    const gr = g.createLinearGradient(0, -20, 0, 20);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#a5f3fc");
    gr.addColorStop(0.7, "#22d3ee"); gr.addColorStop(1, "rgba(34,211,238,0)");
    g.fillStyle = gr; g.fillRect(-4, -20, 8, 40);
    g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(-1.5, -20, 3, 40);
  });
  SPR.drone = makeSprite(24, 24, (g) => { // orbiting gun drone
    g.fillStyle = "#083344"; g.strokeStyle = "#22d3ee"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(8, 8); g.lineTo(-8, 8);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#a5f3fc"; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
  });
  // enemy bullets: shape-coded by type
  SPR.ebR = glowSprite(20, "rgba(248,113,113,0.9)");          // normal: red orb
  SPR.ebM = glowSprite(24, "rgba(255,0,255,0.9)");             // boss: magenta orb
  SPR.ebD = makeSprite(24, 24, (g) => {                        // heavy: magenta diamond
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, 12);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.45, "#f0f"); gr.addColorStop(1, "rgba(255,0,255,0)");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(9, 0); g.lineTo(0, 11); g.lineTo(-9, 0);
    g.closePath(); g.fill();
  });
  SPR.ebT = makeSprite(22, 26, (g) => {                        // homing missile: triangle
    const gr = g.createRadialGradient(0, 2, 1, 0, 2, 13);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.5, "#f0abfc"); gr.addColorStop(1, "rgba(240,171,252,0)");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(10, 10); g.lineTo(-10, 10);
    g.closePath(); g.fill();
  });
  SPR.trail = makeSprite(12, 40, (g) => { // motion streak for enemy bullets
    const gr = g.createLinearGradient(0, -20, 0, 20);
    gr.addColorStop(0, "rgba(248,113,113,0)");
    gr.addColorStop(0.6, "rgba(248,113,113,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0.9)");
    g.fillStyle = gr; g.fillRect(-2.5, -20, 5, 40);
  });
  SPR.dot = {};
  for (const [name, col] of [["cyan", "#22d3ee"], ["mag", "#f0f"], ["yel", "#fde047"], ["org", "#fb923c"],
                             ["red", "#f87171"], ["wht", "#ffffff"], ["lim", "#a3e635"], ["blu", "#7dd3fc"]]) {
    SPR.dot[name] = glowSprite(16, col, "#ffffff");
  }
  // powerup orbs
  const withAlpha = (hex, a) => {           // tolerate 3-digit hex before appending alpha
    let h = String(hex).replace("#", "");
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    return "#" + h + a;
  };
  const orb = (color, letter) => makeSprite(44, 44, (g) => {
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 21);
    gr.addColorStop(0, "rgba(255,255,255,0.9)");
    gr.addColorStop(0.35, withAlpha(color, "55"));
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
    g.strokeStyle = color; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
    g.fillStyle = "#fff"; g.font = "700 15px Orbitron, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(letter, 0, 1);
  });
  SPR.pow = {
    health: orb("#a3e635", "+"),
    weapon: orb("#fde047", "W"),
    life:   orb("#f87171", "+1"),
    shield: orb("#22d3ee", "S"),
    rapid:  orb("#f0f", "R"),
    drone:  orb("#c084fc", "D"),
  };
  SPR.shield = makeSprite(84, 84, (g) => {
    const gr = g.createRadialGradient(0, 0, 28, 0, 0, 41);
    gr.addColorStop(0, "rgba(34,211,238,0)");
    gr.addColorStop(0.8, "rgba(34,211,238,0.25)");
    gr.addColorStop(1, "rgba(34,211,238,0.75)");
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 41, 0, TAU); g.fill();
  });
  SPR.eshield = makeSprite(64, 64, (g) => { // shielded-enemy ring
    g.strokeStyle = "rgba(34,211,238,0.9)"; g.lineWidth = 2.5;
    g.setLineDash([7, 5]);
    g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.stroke();
  });
}
// rebuild once the display font arrives, so orb letters bake in with Orbitron
if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { try { buildSprites(); } catch (e) {} });
}

/* ── game state ──────────────────────────────────────────── */
const S = {
  running: false, paused: false, mode: "sortie",
  score: 0, best: parseInt(store.get("sfBest", "0"), 10) || 0,
  bestStart: 0, overAt: 0,
  wave: 1, lives: 3, hp: 75, maxHp: 75,
  time: 0, kills: 0,
  streak: 0, comboT: 0, mult: 1, maxMult: 1,
  grazes: 0, grazeAcc: 0, shots: 0, hits: 0,
  spawned: 0, quota: 0, spawnT: 0,
  bossWave: false, bossWarn: 0, boss: null,
  theme: null, lastTheme: null, bag: null, mods: [], rogue: false, autoFire: false,
  waveBreak: 0, waveBonus: 0,
  bomb: 0,
  trauma: 0, redFlash: 0, hitStop: 0,
  bannerT: 0,
};
const player = {
  x: 0, y: 0, r: 13, hitR: 6, speed: 370,
  fireT: 0, weapon: 1, inv: 0, shield: 0, rapid: 0,
  overcharge: 0, drones: 0, droneA: 0, droneT: 0,
};
const grazeAgg = { n: 0, pts: 0, f: null }; // aggregated graze floater

/* ── pools (fixed size, no per-frame allocation) ─────────── */
function makePool(n, factory) {
  const a = new Array(n);
  for (let i = 0; i < n; i++) { const o = factory(); o.active = false; a[i] = o; }
  return a;
}
const pbullets = makePool(200, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 1, pierce: 0, hom: 0, laser: false, rico: false, lastE: null, hitCd: 0 }));
const ebullets = makePool(420, () => ({ x: 0, y: 0, vx: 0, vy: 0, grazed: false, boss: false, dmg: 12, homing: false, life: 0 }));
const parts    = makePool(700, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 8, spr: null, drag: 1 }));
function alloc(pool) {
  for (let i = 0; i < pool.length; i++) if (!pool[i].active) { pool[i].active = true; return pool[i]; }
  return null; // pool exhausted — drop it (better than GC churn)
}
const enemies = [];   // small counts; swap-remove
const powerups = [];
const floaters = [];
const rings = [];

/* ── starfield (3 parallax layers) ───────────────────────── */
let stars = [];
function initStars() {
  stars = [];
  const layers = [
    { n: 90, sp: 26, sz: 1.4, a: 0.35 },
    { n: 55, sp: 60, sz: 2.0, a: 0.6 },
    { n: 28, sp: 120, sz: 2.8, a: 0.9 },
  ];
  for (const L of layers)
    for (let i = 0; i < L.n; i++)
      stars.push({ x: rand(0, W), y: rand(0, H), sp: L.sp * rand(0.7, 1.3), sz: L.sz, a: L.a });
}
function buildBackdrops() {
  nebulaCv = document.createElement("canvas");
  nebulaCv.width = Math.max(2, W >> 1); nebulaCv.height = Math.max(2, H >> 1);
  const g = nebulaCv.getContext("2d");
  g.scale(0.5, 0.5);
  const blobs = [
    [W * 0.22, H * 0.3, Math.min(W, H) * 0.5, "rgba(120,20,160,0.10)"],
    [W * 0.8, H * 0.62, Math.min(W, H) * 0.55, "rgba(20,90,160,0.10)"],
    [W * 0.55, H * 0.12, Math.min(W, H) * 0.35, "rgba(160,20,90,0.07)"],
  ];
  for (const [x, y, r, col] of blobs) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  vigCv = document.createElement("canvas");
  vigCv.width = Math.max(2, W >> 1); vigCv.height = Math.max(2, H >> 1);
  const v = vigCv.getContext("2d");
  v.scale(0.5, 0.5);
  const vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,5,0.55)");
  v.fillStyle = vg; v.fillRect(0, 0, W, H);
}

/* ── input ───────────────────────────────────────────────── */
const keys = {};
const GAME_KEYS = ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "KeyP", "KeyM", "KeyB", "Escape"];
document.addEventListener("keydown", (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === "KeyP" || e.code === "Escape") togglePause();
  if (e.code === "KeyM") toggleMute();
  if (e.code === "KeyB") fireBomb();
  if (e.code === "Space" && !S.running) {
    if (Date.now() - S.overAt < 800) return; // don't skip the death screen by mashing fire
    startGame();
  }
});
document.addEventListener("keyup", (e) => { keys[e.code] = false; });

// touch steering: "drag" (relative, finger never covers the ship) or
// "follow" (ship eases toward the fingertip, mouse-style). mobile only.
let touchMode = "drag";
try { const sm = store.get("sfTouch", "drag"); touchMode = (sm === "follow") ? "follow" : "drag"; } catch (e) {}
let dragId = null, dragX = 0, dragY = 0;
let followId = null;
const followT = { x: 0, y: 0 };
function setFollow(t) {
  followT.x = clamp(t.clientX, 24, W - 24);
  followT.y = clamp(t.clientY - 80, H * 0.22, H - 56); // ship rides above the fingertip
}
function setTouchMode(m) {
  touchMode = (m === "follow") ? "follow" : "drag";
  followId = null; dragId = null;
  try { store.set("sfTouch", touchMode); } catch (e) {}
  if (document.querySelectorAll) {
    document.querySelectorAll(".seg-btn").forEach((b) =>
      b.classList.toggle("on", b.dataset.tm === touchMode));
  }
}
canvas.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  if (touchMode === "follow") {
    if (followId === null) { followId = t.identifier; setFollow(t); }
  } else if (dragId === null) { dragId = t.identifier; dragX = t.clientX; dragY = t.clientY; }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches) {
    if (touchMode === "follow") { if (t.identifier === followId) setFollow(t); continue; }
    if (t.identifier !== dragId) continue;
    player.x = clamp(player.x + (t.clientX - dragX) * 1.25, 24, W - 24);
    player.y = clamp(player.y + (t.clientY - dragY) * 1.25, H * 0.25, H - 56);
    dragX = t.clientX; dragY = t.clientY;
  }
  e.preventDefault();
}, { passive: false });
const endTouch = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === followId) followId = null;
    if (t.identifier === dragId) dragId = null;
  }
};
canvas.addEventListener("touchend", endTouch);
canvas.addEventListener("touchcancel", endTouch);

// mouse: move-to-follow + click/hold to fire (desktop)
const mouse = { x: 0, y: 0, t: 0, down: false };
canvas.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); });
canvas.addEventListener("mousedown", (e) => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); });
window.addEventListener("mouseup", () => { mouse.down = false; });

// fire button (touch + mouse)
let touchFire = false;
const fireOn = (e) => { e.preventDefault(); touchFire = true; };
const fireOff = (e) => { e.preventDefault(); touchFire = false; };
fireBtn.addEventListener("touchstart", fireOn, { passive: false });
fireBtn.addEventListener("touchend", fireOff);
fireBtn.addEventListener("touchcancel", fireOff);
fireBtn.addEventListener("mousedown", fireOn);
fireBtn.addEventListener("mouseup", fireOff);
fireBtn.addEventListener("mouseleave", fireOff);
bombBtn.addEventListener("click", (e) => { e.preventDefault(); fireBomb(); });

document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(true); });
window.addEventListener("blur", () => pauseGame(true));
window.addEventListener("resize", () => { clearTimeout(window.__rzT); window.__rzT = setTimeout(resize, 120); });

/* ── enemies ─────────────────────────────────────────────── */
const ECFG = {
  basic:     { hp: 1, score: 100, r: 16, shotDmg: 10, shotSpd: 250 },
  fast:      { hp: 1, score: 150, r: 15, shotDmg: 8,  shotSpd: 300 },
  tank:      { hp: 5, score: 300, r: 20, shotDmg: 12, shotSpd: 240 },
  diver:     { hp: 2, score: 200, r: 14, shotDmg: 0,  shotSpd: 0 },
  sniper:    { hp: 2, score: 250, r: 15, shotDmg: 18, shotSpd: 340 },
  splitter:  { hp: 3, score: 250, r: 17, shotDmg: 10, shotSpd: 260 },
  minelayer: { hp: 2, score: 300, r: 18, shotDmg: 0,  shotSpd: 0 },
  mine:      { hp: 1, score: 50,  r: 10, shotDmg: 15, shotSpd: 0 },
};
function spawnEnemy(type, x, y, side, shielded) {
  const c = ECFG[type];
  const e = {
    type, x: x !== undefined ? x : rand(40, W - 40), y: y !== undefined ? y : -40,
    vx: 0, vy: 0, hp: c.hp, maxHp: c.hp, score: c.score, r: c.r,
    t: rand(0, 10), fireT: rand(1.0, 2.2), flash: 0,
    phase: 0, phaseT: 0, tx: 0, ty: 0, sx: 0, burst: 0, burstT: 0,
    sh: 0, hist: null, follow: null, mineT: 0, // shield charges / snake trail / mine timer
  };
  const w = S.wave;
  const aggro = Math.pow(0.96, w); // shoot more often on later waves
  if (shielded && (type === "tank" || type === "diver" || type === "sniper" || type === "splitter")) e.sh = 3;
  if (side) e.vx = (e.x < W / 2 ? 1 : -1) * rand(110, 160);
  if (type === "basic")    { e.hp = e.maxHp = 1; e.vy = 100 + w * 11; e.fireT = rand(2.2, 3.4) * aggro; }
  if (type === "fast")     { e.hp = e.maxHp = 1; e.vy = 180 + w * 14; e.sx = e.x; }
  if (type === "tank")     { e.hp = e.maxHp = 5 + Math.floor(w * 0.75); e.vy = 58; e.fireT = rand(1.1, 1.7) * aggro; }
  if (type === "diver")    { e.hp = e.maxHp = 2; e.vy = 130; }
  if (type === "sniper")   { e.hp = e.maxHp = 2; e.vy = 90; e.sx = e.x; e.fireT = rand(1.6, 2.6) * aggro; }
  if (type === "splitter") { e.hp = e.maxHp = 3; e.vy = 85 + w * 8; e.fireT = rand(2.4, 3.6) * aggro; }
  if (type === "minelayer"){ e.hp = e.maxHp = 2; e.vy = 95; e.mineT = rand(1.2, 2.0); }
  if (type === "mine")     { e.hp = e.maxHp = 1; e.vy = 32; e.fuse = 15; }
  enemies.push(e);
  return e;
}
function mineCount() {
  let n = 0;
  for (const e of enemies) if (e.type === "mine") n++;
  return n;
}
// V formation: 5 basics sweeping in together
function spawnV() {
  const cx = rand(W * 0.3, W * 0.7);
  const offs = [[0, 0], [-46, -44], [46, -44], [-92, -88], [92, -88]];
  for (const [ox, oy] of offs) spawnEnemy("basic", clamp(cx + ox, 30, W - 30), -40 + oy);
}
// snake formation: 4 fasts, followers trail the leader
function spawnSnake() {
  let prev = null;
  for (let k = 0; k < 4; k++) {
    const e = spawnEnemy("fast", rand(W * 0.3, W * 0.7), -40 - k * 46);
    e.follow = prev; e.hist = [];
    prev = e;
  }
}

/* ── bosses: 3 distinct dreadnoughts, scaling tiers ─────── */
const BOSS_DEFS = [
  { id: "warden", name: "WARDEN", spr: "bossWarden", color: "#f87171",
    hp: 168, score: 2000, r: 48, attacks: ["spread", "rings", "summon"], tierAttacks: ["burst"] },
  { id: "lancer", name: "LANCER", spr: "bossLancer", color: "#c084fc",
    hp: 140, score: 2500, r: 40, attacks: ["burst", "sweep", "dash"], tierAttacks: ["rings"] },
  { id: "hive",   name: "HIVE",   spr: "bossHive",   color: "#4ade80",
    hp: 224, score: 3000, r: 52, attacks: ["spiral", "missiles", "hatch"], tierAttacks: ["spread"] },
];
function bossForWave(w) { // w % 3 === 0
  const idx = Math.round(w / 3) - 1;
  return { def: BOSS_DEFS[idx % 3], tier: Math.floor(idx / 3) };
}
function spawnBoss(defId, tier, mini, x, y) {
  const def = BOSS_DEFS.find((d) => d.id === defId) || BOSS_DEFS[0];
  tier = tier || 0;
  const hpMul = (mini ? 0.30 : 1) * (1 + 0.55 * tier);
  const atk = def.attacks.slice(0, mini ? 2 : 3);
  if (!mini && tier >= 1) atk.push(...def.tierAttacks); // higher tiers: extra weapons
  const hp = Math.round(def.hp * hpMul);
  const e = {
    type: "boss", def, tier, mini: !!mini,
    x: x !== undefined ? x : W / 2, y: y !== undefined ? y : -80,
    vx: 0, vy: 70, hp, maxHp: hp,
    score: mini ? 800 : Math.round(def.score * (1 + 0.5 * tier)),
    r: mini ? Math.round(def.r * 0.55) : def.r,
    t: rand(0, 10), fireT: 1.2, flash: 0,
    atk: atk[0], atkIdx: 0, atkT: 1.8, attacks: atk,
    phase: 0, phaseT: 0, tx: 0, ty: 0, sx: 0, burst: 0, burstT: 0,
    sweepA: 0, dash: 0, dashT: 0,
    enraged: false, enrageT: 0, erT: 0,
    compT: mini ? 0 : 12, compN: 0, // companion timer (main bosses only)
  };
  enemies.push(e);
  return e;
}
function minisAlive() {
  for (const e of enemies) if (e.type === "boss" && e.mini) return true;
  return false;
}
function spawnCompanion(boss) {
  // a demoted earlier boss joins the fight as a companion — rare, not common
  if (minisAlive()) return;
  const idx = BOSS_DEFS.indexOf(boss.def);
  const prev = BOSS_DEFS[(idx + BOSS_DEFS.length - 1) % BOSS_DEFS.length];
  const m = spawnBoss(prev.id, 0, true, rand(W * 0.25, W * 0.75), -60);
  floater(m.x, 130, prev.name + " ASSIST", prev.color, true);
  sfx.warn(); buzz([40, 40, 40]);
}

/* ── wave themes: every wave feels different ─────────────── */
const THEMES = [
  { id: "first",   label: "FIRST CONTACT",  bag: [["basic", 1]], int: 1.05 },
  { id: "swarm",   label: "SWARM",          bag: [["fast", 13], ["basic", 8], ["diver", 5]], int: 0.72 },
  { id: "armored", label: "ARMORED COLUMN", bag: [["tank", 10], ["diver", 6], ["basic", 6]], int: 1.0 },
  { id: "ambush",  label: "AMBUSH",         bag: [["sniper", 8], ["diver", 8], ["fast", 7]], int: 0.85, sides: true },
  { id: "cross",   label: "CROSSFIRE",      bag: [["basic", 8], ["sniper", 7], ["tank", 6], ["diver", 5]], int: 0.85 },
  { id: "surge",   label: "SURGE",          bag: [["basic", 9], ["fast", 8], ["tank", 6], ["diver", 5], ["sniper", 5]], int: 0.62, qmul: 1.3 },
];
const MOD_LABEL = { shielded: "SHIELDED", fast: "FAST ROUNDS", formation: "FORMATIONS" };
function pickType() {
  if (S.wave === 1) return "basic";
  const bag = S.bag || S.theme.bag;
  let total = 0;
  for (const [, wt] of bag) total += wt;
  let r = R() * total;
  for (const [t, wt] of bag) { r -= wt; if (r <= 0) return t; }
  return "basic";
}

/* ── waves ───────────────────────────────────────────────── */
function startWave(n) {
  S.wave = n;
  S.spawned = 0; S.spawnT = 1.0; S.rogue = false;
  S.bossWave = (n % 3 === 0);
  S.mods = [];
  waveEl.textContent = n;
  if (S.bossWave) {
    const { def, tier } = bossForWave(n);
    S.bossWarn = 2.4;
    showBanner("WARNING", def.name + (tier > 0 ? " — TIER " + (tier + 1) : "") + " approaching", "warn", 2.4);
    sfx.warn(); buzz([50, 60, 50]);
  } else {
    let theme;
    if (n === 1) { theme = THEMES[0]; }
    else {
      const pool = THEMES.slice(1);
      do { theme = pool[(R() * pool.length) | 0]; } while (theme.id === S.lastTheme);
    }
    S.theme = theme; S.lastTheme = theme.id;
    // wave-scaled bag: new enemy types join as waves climb
    const bag = theme.bag.map(([t, w]) => [t, w]);
    if (n >= 3) bag.push(["splitter", 4]);
    if (n >= 4) bag.push(["minelayer", 3]);
    if (n >= 5) { const tk = bag.find((b) => b[0] === "tank"); if (tk) tk[1] += 3; }
    S.bag = bag;
    // wave modifiers: new rules on later waves
    if (n >= 4 && R() < 0.45) {
      const mods = ["shielded", "fast", "formation"];
      S.mods.push(mods[(R() * mods.length) | 0]);
      if (n >= 7 && R() < 0.35) {
        const m2 = mods[(R() * mods.length) | 0];
        if (!S.mods.includes(m2)) S.mods.push(m2);
      }
    }
    S.quota = n === 1 ? 8 : Math.round((8 + n * 2.2) * (theme.qmul || 1));
    const modTxt = S.mods.length ? " · " + S.mods.map((m) => MOD_LABEL[m]).join(" · ") : "";
    showBanner("WAVE " + n, theme.label + modTxt, "", 1.8);
  }
}
function waveProgress() {
  if (S.bossWave) {
    if (S.boss) return 1 - S.boss.hp / S.boss.maxHp;
    return minisAlive() ? 0.99 : 1;
  }
  return clamp(S.spawned / Math.max(1, S.quota), 0, 1);
}
function director(dt) {
  if (S.bossWarn > 0) {
    S.bossWarn -= dt;
    if (S.bossWarn <= 0) {
      const { def, tier } = bossForWave(S.wave);
      S.boss = spawnBoss(def.id, tier, false);
      bossNameEl.textContent = def.name + (tier > 0 ? " +" + tier : "");
      bossBar.classList.remove("hidden");
      sfx.warn();
    }
    return;
  }
  if (S.boss) return; // main boss active
  if (S.bossWave) {
    // boss down: mop up any companion minis before advancing
    if (minisAlive()) return;
    if (S.waveBreak <= 0) S.waveBreak = 2.6;
    S.waveBreak -= dt;
    if (S.waveBreak <= 0) startWave(S.wave + 1);
    return;
  }
  if (S.waveBreak > 0) {
    S.waveBreak -= dt;
    if (S.waveBreak <= 0) startWave(S.wave + 1);
    return;
  }
  if (S.spawned < S.quota) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      const th = S.theme;
      if (S.mods.includes("formation") && R() < 0.3) {
        if (R() < 0.5) { spawnV(); S.spawned += 5; }
        else { spawnSnake(); S.spawned += 4; }
      } else {
        const type = pickType();
        const shielded = S.mods.includes("shielded") && R() < 0.35;
        if (th.sides && R() < 0.3) {
          const left = R() < 0.5;
          spawnEnemy(type, left ? -30 : W + 30, rand(60, H * 0.35), true, shielded);
        } else spawnEnemy(type, undefined, undefined, false, shielded);
        S.spawned++;
      }
      S.spawnT = Math.max(0.34, th.int - S.wave * 0.02) * rand(0.7, 1.2);
    }
    // rogue boss: a demoted boss sometimes crashes a normal wave
    if (!S.rogue && S.wave >= 6 && S.spawned > S.quota * 0.35 && R() < 0.09) {
      S.rogue = true;
      const def = BOSS_DEFS[(R() * BOSS_DEFS.length) | 0];
      spawnBoss(def.id, 0, true);
      showBanner("ROGUE SIGNAL", def.name + " detected", "warn", 2.0);
      sfx.warn(); buzz([40, 40, 40]);
    }
  } else if (enemies.length === 0) {
    // wave clear
    S.waveBonus = 150 * S.wave;
    addScore(S.waveBonus);
    S.hp = Math.min(S.maxHp, S.hp + 10);
    showBanner("WAVE CLEAR", "+" + S.waveBonus + " bonus", "gold", 2.0);
    sfx.waveClear();
    S.waveBreak = 2.4;
  }
}

/* ── boss brains: 9 distinct attack patterns + enrage phases ─ */
function atkDur(a) {
  switch (a) {
    case "spread": return 3.2;
    case "rings": return 3.4;
    case "summon": return 2.6;
    case "burst": return 2.8;
    case "sweep": return 2.2;
    case "dash": return 2.8;
    case "spiral": return 3.0;
    case "missiles": return 3.0;
    case "hatch": return 3.0;
    default: return 3.0;
  }
}
function minionCount() {
  let n = 0;
  for (const e of enemies) if (e.type !== "boss") n++;
  return n;
}
function updateBoss(e, dt) {
  if (e.phase === 0) { // entrance
    e.y += e.vy * dt;
    if (e.y >= 130) e.phase = 1;
    return;
  }
  // enrage trigger at 50% HP: banner + brief invulnerable transition
  if (!e.enraged && e.hp <= e.maxHp / 2) {
    e.enraged = true;
    e.enrageT = 1.3;
    showBanner(e.def.name + " ENRAGED", "attacks intensify", "warn", 1.6);
    sfx.warn(); shake(0.5); buzz([60, 60, 60]);
  }
  if (e.enrageT > 0) { // transition: invulnerable, flashing
    e.enrageT -= dt;
    e.flash = 0.05;
    return;
  }
  // strafe (paused while dashing)
  if (e.dash === 0) {
    const spd = (e.mini ? 0.85 : 0.55) + e.tier * 0.1 + (e.enraged ? 0.15 : 0);
    e.x = W / 2 + Math.sin(e.t * spd) * W * (e.mini ? 0.22 : 0.32);
  }
  // cycle attacks
  e.atkT -= dt;
  if (e.atkT <= 0) {
    e.atkIdx = (e.atkIdx + 1) % e.attacks.length;
    e.atk = e.attacks[e.atkIdx];
    e.atkT = atkDur(e.atk);
    e.fireT = 0.3; e.burst = 0; e.burstT = 0; e.sweepA = -1.05;
    e.dash = 0; e.dashT = 0; e.vx = 0; e.vy = 0;
  }
  bossAttack(e, dt);
  // enraged bonus: extra aimed shots woven between patterns
  if (e.enraged) {
    e.erT -= dt;
    if (e.erT <= 0) { e.erT = 1.15; enemyShoot(e.x, e.y + 30, 300, true, true, 12); }
  }
  // companions: a demoted earlier boss joins mid-fight (main bosses only)
  if (!e.mini && e.compN < 2) {
    e.compT -= dt;
    if (e.compT <= 0) { spawnCompanion(e); e.compN++; e.compT = 16; }
  }
}
function bossAttack(e, dt) {
  const cx = e.x, cy = e.y + 30;
  const rate = Math.pow(0.9, e.tier) * (e.enraged ? 0.7 : 1); // higher tiers + enrage fire faster
  switch (e.atk) {
    case "spread": // WARDEN signature: aimed 5-fan
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = 1.1 * rate; spreadShot(cx, cy, 5, 0.17, 260, 12, true); }
      break;
    case "rings": // radial bullet ring
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 1.7 * rate;
        const n = 16, off = e.t;
        for (let k = 0; k < n; k++) {
          const b = alloc(ebullets); if (!b) break;
          const a = k / n * TAU + off;
          b.x = e.x; b.y = e.y;
          b.vx = Math.cos(a) * 165; b.vy = Math.sin(a) * 165;
          b.grazed = false; b.boss = true; b.dmg = 10; b.homing = false; b.life = 0;
        }
        sfx.eshoot(); shake(0.25);
      }
      break;
    case "summon": // call reinforcements + aimed shot
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 2.5 * rate;
        if (minionCount() < 5) {
          spawnEnemy("basic", clamp(e.x - 70, 40, W - 40), e.y + 40);
          spawnEnemy("basic", clamp(e.x + 70, 40, W - 40), e.y + 40);
        }
        enemyShoot(cx, cy, 270, true, true, 12);
      }
      break;
    case "burst": // LANCER signature: rapid aimed 3-round bursts
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = 0.62 * rate; e.burst = 3; e.burstT = 0; }
      if (e.burst > 0) {
        e.burstT -= dt;
        if (e.burstT <= 0) { e.burst--; e.burstT = 0.14; enemyShoot(cx, cy, 315, true, true, 12); }
      }
      break;
    case "sweep": { // sweeping beam arc
      e.fireT -= dt;
      if (e.fireT <= 0 && e.atkT < atkDur("sweep") - 0.35) { // brief telegraph
        e.fireT = 0.07;
        const base = Math.atan2(player.y - e.y, player.x - e.x);
        const b = alloc(ebullets);
        if (b) {
          const a = base + e.sweepA;
          b.x = e.x; b.y = e.y + 10;
          b.vx = Math.cos(a) * 235; b.vy = Math.sin(a) * 235;
          b.grazed = false; b.boss = true; b.dmg = 10; b.homing = false; b.life = 0;
        }
        e.sweepA += 0.16;
      }
      break;
    }
    case "dash": // telegraph, then charge the player
      if (e.dash === 0) { e.dash = 1; e.dashT = 0.8; }
      if (e.dash === 1) {
        e.tx = player.x; e.ty = player.y;
        e.flash = 0.06; e.dashT -= dt;
        if (e.dashT <= 0) {
          const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1;
          e.vx = dx / d * 740; e.vy = dy / d * 740;
          e.dash = 2; e.dashT = 0.55;
          sfx.eshoot(); shake(0.3);
        }
      } else if (e.dash === 2) {
        e.x = clamp(e.x + e.vx * dt, 40, W - 40);
        e.y += e.vy * dt;
        e.dashT -= dt;
        if (e.dashT <= 0 || e.y > H - 140) { e.dash = 3; e.dashT = 0.7; e.vx = 0; e.vy = 0; }
      } else if (e.dash === 3) { // recover to the top
        e.y = Math.max(130, e.y - 200 * dt);
        e.dashT -= dt;
        if (e.dashT <= 0) e.dash = 0;
      }
      break;
    case "spiral": // HIVE signature: twin rotating spiral
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 0.095;
        for (const off of [0, Math.PI]) {
          const b = alloc(ebullets); if (!b) continue;
          const a = e.sweepA + off;
          b.x = e.x; b.y = e.y;
          b.vx = Math.cos(a) * 190; b.vy = Math.sin(a) * 190;
          b.grazed = false; b.boss = true; b.dmg = 10; b.homing = false; b.life = 0;
        }
        e.sweepA += 0.45;
      }
      break;
    case "missiles": // slow homing missiles
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 1.85 * rate;
        for (let k = -1; k <= 1; k++) {
          const b = alloc(ebullets); if (!b) continue;
          const a = Math.PI / 2 + k * 0.35;
          b.x = e.x + k * 24; b.y = e.y + 20;
          b.vx = Math.cos(a) * 220; b.vy = Math.sin(a) * 220;
          b.grazed = false; b.boss = true; b.dmg = 16; b.homing = true; b.life = 4;
        }
        sfx.eshoot();
      }
      break;
    case "hatch": // release divers + bullet ring
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = 3.0 * rate;
        if (minionCount() < 5) {
          spawnEnemy("diver", clamp(e.x - 50, 40, W - 40), e.y + 30);
          spawnEnemy("diver", clamp(e.x + 50, 40, W - 40), e.y + 30);
        }
        const n = 10, off = e.t;
        for (let k = 0; k < n; k++) {
          const b = alloc(ebullets); if (!b) break;
          const a = k / n * TAU + off;
          b.x = e.x; b.y = e.y;
          b.vx = Math.cos(a) * 155; b.vy = Math.sin(a) * 155;
          b.grazed = false; b.boss = true; b.dmg = 10; b.homing = false; b.life = 0;
        }
        sfx.eshoot();
      }
      break;
  }
}

/* ── effects ─────────────────────────────────────────────── */
function burst(x, y, sprName, n, spd, life, size) {
  for (let i = 0; i < n; i++) {
    const p = alloc(parts); if (!p) return;
    const a = rand(0, TAU), v = rand(spd * 0.3, spd);
    p.x = x; p.y = y;
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
    p.life = p.max = rand(life * 0.5, life);
    p.size = rand(size * 0.6, size * 1.4);
    p.spr = SPR.dot[sprName]; p.drag = 0.96;
  }
}
function floater(x, y, txt, color, big) {
  if (floaters.length > 24) floaters.shift();
  const f = { x: clamp(x, 60, W - 60), y, txt, color: color || "#fff", life: 1, big: !!big };
  floaters.push(f);
  return f;
}
function ring(x, y, maxR, color, width) {
  if (rings.length > 12) rings.shift();
  rings.push({ x, y, r: 6, maxR, color, width: width || 3, life: 1 });
}
function shake(amount) {
  if (reduceMotion) return;
  S.trauma = clamp(S.trauma + amount, 0, 1);
}
function showBanner(title, sub, cls, dur) {
  bannerTitle.textContent = title;
  bannerSub.textContent = sub || "";
  banner.className = cls || "";
  banner.classList.remove("hidden");
  S.bannerT = dur;
}

/* ── scoring ─────────────────────────────────────────────── */
function calcMult() { return Math.min(8, 1 + Math.floor(S.streak / 4)); }
function addScore(n) {
  S.score += n;
  scoreEl.textContent = S.score;
  scoreEl.classList.remove("pop");
  void scoreEl.offsetWidth;
  scoreEl.classList.add("pop");
  if (S.score > S.best) { S.best = S.score; bestEl.textContent = S.best; }
}
function registerKill(e) {
  S.kills++;
  S.streak++;
  S.comboT = 2.5;
  const m = calcMult();
  if (m > S.mult) {
    S.mult = m; S.maxMult = Math.max(S.maxMult, m);
    sfx.comboUp(m);
    if (m === 4) streakBanner("RAMPAGE");
    else if (m === 6) streakBanner("FRENZY");
    else if (m === 8) streakBanner("UNSTOPPABLE");
  }
  const pts = e.score * S.mult;
  addScore(pts);
  floater(e.x, e.y - 10, "+" + pts, S.mult >= 4 ? "#fbbf24" : "#e8f4ff", S.mult >= 4);
  chargeBomb(6);
}
function streakBanner(txt) {
  if (banner.classList.contains("hidden")) showBanner(txt, "combo ×" + S.mult, "gold", 1.1);
}
function computeRank(score) {
  if (score >= 250000) return "S";
  if (score >= 120000) return "A";
  if (score >= 60000) return "B";
  if (score >= 25000) return "C";
  return "D";
}

/* ── player weapons: levels change behavior, not just count ─ */
function fireInterval() { return player.rapid > 0 ? 0.075 : 0.15; }
function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = (maxD || 1e9) * (maxD || 1e9);
  for (const e of enemies) {
    if (e === exclude) continue;
    const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = e; }
  }
  return best;
}
function playerFire() {
  const bx = player.x, by = player.y - 30;
  const mk = (x, y, vx, vy, opt) => {
    const b = alloc(pbullets); if (!b) return;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.dmg = 1; b.pierce = 0; b.hom = 0; b.laser = false; b.rico = false;
    b.lastE = null; b.hitCd = 0;
    if (opt) Object.assign(b, opt);
    S.shots++;
  };
  if (player.overcharge > 0) {
    // OVERCHARGE: piercing laser bolts
    mk(bx - 10, by, 0, -800, { dmg: 2, pierce: 99, laser: true });
    mk(bx + 10, by, 0, -800, { dmg: 2, pierce: 99, laser: true });
    mk(bx, by - 6, 0, -860, { dmg: 2, pierce: 99, laser: true });
    sfx.laser();
  } else if (player.weapon >= 3) {
    // L3: triple — middle bolt pierces, side bolts steer slightly
    mk(bx, by, 0, -740, { pierce: 1 });
    mk(bx - 14, by + 6, -110, -700, { hom: 2.2 });
    mk(bx + 14, by + 6, 110, -700, { hom: 2.2 });
    sfx.shootUp();
  } else if (player.weapon === 2) {
    mk(bx - 9, by, 0, -740); mk(bx + 9, by, 0, -740);
    sfx.shootUp();
  } else { mk(bx, by, 0, -740); sfx.shoot(); }
  // muzzle flash (additive in render)
  burst(bx, by - 4, "wht", 2, 70, 0.12, 11);
}
function droneFire() {
  // orbiting drones shoot the nearest enemy; their shots ricochet once
  for (let d = 0; d < player.drones; d++) {
    const a = player.droneA + d * Math.PI;
    const dx = player.x + Math.cos(a) * 56, dy = player.y + Math.sin(a) * 56;
    const tgt = nearestEnemy(dx, dy, 520);
    if (!tgt) continue;
    const b = alloc(pbullets); if (!b) continue;
    const ang = Math.atan2(tgt.y - dy, tgt.x - dx);
    b.x = dx; b.y = dy;
    b.vx = Math.cos(ang) * 660; b.vy = Math.sin(ang) * 660;
    b.dmg = 1; b.pierce = 0; b.hom = 0; b.laser = false; b.rico = true;
    b.lastE = null; b.hitCd = 0;
    S.shots++;
  }
}
function bspd(s) { return S.mods.includes("fast") ? s * 1.35 : s; } // FAST ROUNDS modifier
function enemyShoot(x, y, spd, aimed, boss, dmg, homing) {
  const b = alloc(ebullets); if (!b) return;
  spd = bspd(spd) * 0.92; // hostile rounds fly a touch slower
  let vx = 0, vy = spd;
  if (aimed) {
    const dx = player.x - x, dy = player.y - y;
    const d = Math.hypot(dx, dy) || 1;
    vx = dx / d * spd; vy = dy / d * spd;
  }
  b.x = x; b.y = y; b.vx = vx; b.vy = vy;
  b.grazed = false; b.boss = !!boss;
  b.dmg = dmg || 12; b.homing = !!homing; b.life = homing ? 4 : 0;
  sfx.eshoot();
}
// fan of n shots centered on the player's direction
function spreadShot(x, y, n, fan, spd, dmg, boss) {
  spd = bspd(spd) * 0.92; // hostile rounds fly a touch slower
  const base = Math.atan2(player.y - y, player.x - x);
  for (let k = 0; k < n; k++) {
    const b = alloc(ebullets); if (!b) continue;
    const a = base + (k - (n - 1) / 2) * fan;
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
    b.grazed = false; b.boss = !!boss; b.dmg = dmg || 12; b.homing = false; b.life = 0;
  }
  sfx.eshoot();
}

/* ── bomb: screen-clear charged by grazes + kills ────────── */
function chargeBomb(n) {
  if (!S.running || S.bomb >= 100) return;
  S.bomb = Math.min(100, S.bomb + n);
  if (S.bomb >= 100) { sfx.power(); floater(player.x, player.y - 44, "BOMB READY", "#fde047", true); }
}
function fireBomb() {
  if (!S.running || S.paused || S.bomb < 100) return;
  S.bomb = 0;
  // clear every enemy bullet (+5 each), hammer everything on screen
  let cleared = 0;
  for (const b of ebullets) {
    if (!b.active) continue;
    b.active = false; cleared++;
    burst(b.x, b.y, "wht", 2, 120, 0.35, 9);
  }
  if (cleared) addScore(Math.min(1500, cleared * 5));
  const targets = enemies.slice();
  for (const e of targets) {
    if (enemies.indexOf(e) < 0) continue;
    // boss bomb damage capped at 30% of max HP: bombs help, but can't skip a boss fight
    // (minis are adds and still take the full hit)
    let bd = 80;
    if (e.type === "boss") bd = e.mini ? 150 : Math.min(150, Math.round(e.maxHp * 0.3));
    damageEnemy(e, bd, e.x, e.y);
    const idx = enemies.indexOf(e);
    if (idx >= 0 && e.hp <= 0) { enemies[idx] = enemies[enemies.length - 1]; enemies.pop(); }
  }
  ring(player.x, player.y, Math.max(W, H), "#fde047", 6);
  ring(player.x, player.y, Math.max(W, H) * 0.6, "#ffffff", 4);
  S.redFlash = 0; shake(1);
  sfx.bomb(); buzz([80, 50, 80]);
}

/* ── damage ──────────────────────────────────────────────── */
function hurtPlayer(dmg, sx, sy) {
  if (!S.running || S.paused) return;
  if (player.inv > 0) return;
  if (player.shield > 0) {
    burst(sx, sy, "cyan", 10, 220, 0.4, 10);
    sfx.hit();
    return;
  }
  S.hp -= dmg;
  player.inv = 1.2;
  S.redFlash = 0.55;
  shake(0.55);
  sfx.hurt(); buzz(35);
  burst(player.x, player.y, "red", 16, 260, 0.5, 11);
  // getting hit costs combo: drop one multiplier step
  if (S.mult > 1) {
    S.mult = Math.max(1, S.mult - 1);
    S.streak = (S.mult - 1) * 4;
    floater(player.x, player.y - 40, "COMBO LOST", "#f87171");
  }
  S.comboT = Math.min(S.comboT, 1.0);
  if (S.hp <= 0) loseLife();
}
function loseLife() {
  S.lives--;
  burst(player.x, player.y, "org", 40, 380, 0.9, 14);
  burst(player.x, player.y, "wht", 20, 260, 0.7, 12);
  ring(player.x, player.y, 130, "#22d3ee", 4);
  shake(1); sfx.boomB(); buzz([60, 40, 60]);
  S.streak = 0; S.mult = 1; S.comboT = 0;
  if (S.lives <= 0) { gameOver(); return; }
  S.hp = S.maxHp;
  player.weapon = Math.max(1, player.weapon - 1);
  player.drones = 0;
  player.x = W / 2; player.y = H - 110;
  player.inv = 2.2; player.shield = 0;
}

/* ── kills ───────────────────────────────────────────────── */
function damageEnemy(e, dmg, hx, hy) {
  if (e.hp <= 0) return;
  if (e.type === "boss" && e.enrageT > 0) return; // invulnerable during enrage transition
  if (e.sh > 0) { // shielded enemy: charges absorb hits first
    e.sh--;
    e.flash = 0.09;
    burst(hx, hy, "cyan", 6, 180, 0.3, 9);
    ring(e.x, e.y, e.r + 16, "#22d3ee", 2);
    sfx.hit();
    return;
  }
  e.hp -= dmg;
  e.flash = 0.09;
  S.hits++;
  burst(hx, hy, "cyan", 4, 160, 0.3, 8);
  sfx.hit();
  if (e.hp > 0) return;
  // dead
  const big = e.type === "tank" || e.type === "boss";
  registerKill(e);
  sfx.kill(S.streak);
  const cols = e.type === "boss" ? ["mag", "wht", "org"] : e.type === "tank" ? ["org", "yel", "red"] : ["mag", "blu", "wht"];
  for (const c of cols) burst(e.x, e.y, c, big ? 14 : 8, big ? 320 : 240, big ? 0.8 : 0.55, big ? 13 : 10);
  if (big) {
    const bcol = e.type === "boss" ? (e.def ? e.def.color : "#f0f") : "#fb923c";
    ring(e.x, e.y, e.mini ? 130 : 220, bcol, 4);
    shake(e.type === "boss" && !e.mini ? 1 : 0.6);
    if (!reduceMotion) S.hitStop = e.type === "boss" && !e.mini ? 0.22 : 0.09;
    sfx.boomB();
  } else { shake(0.18); sfx.boomS(); }
  if (e.type === "splitter") {
    // burst into two fasts
    for (const ox of [-22, 22]) {
      const f = spawnEnemy("fast", clamp(e.x + ox, 30, W - 30), e.y);
      f.vy = 200;
    }
    floater(e.x, e.y - 14, "SPLIT", "#fdba74");
  }
  if (e.type === "boss") {
    if (e.mini) maybeDrop(e.x, e.y, 0.5);
    else { maybeDrop(e.x - 50, e.y, 1); maybeDrop(e.x + 50, e.y, 0.6); }
  } else if (e.type !== "mine") maybeDrop(e.x, e.y, 0.08);
  if (e.type === "boss") bossDown(e);
}
function bossDown(e) {
  if (e.mini) { // companion / rogue mini-boss
    showBanner(e.def.name + " DOWN", "+800", "gold", 1.6);
    return;
  }
  S.boss = null;
  bossBar.classList.add("hidden");
  const bonus = Math.round(500 * S.wave * (1 + e.tier * 0.5));
  addScore(bonus);
  showBanner(e.def.name + " DOWN", "+" + bonus + " bonus", "gold", 2.2);
  sfx.waveClear();
  if (!minisAlive()) S.waveBreak = 2.6;
}

/* ── powerups ────────────────────────────────────────────── */
const POWS = [
  ["health", 0.14], ["weapon", 0.26], ["shield", 0.20],
  ["rapid", 0.20], ["drone", 0.14], ["life", 0.06],
];
function maybeDrop(x, y, chance) {
  if (R() > chance) return;
  let r = R(), type = "health";
  for (const [t, w] of POWS) { r -= w; if (r <= 0) { type = t; break; } }
  if (powerups.length > 8) powerups.shift();
  powerups.push({ x: clamp(x, 30, W - 30), y, type, t: 0, life: 9 });
}
function applyPowerup(p) {
  const t = p.type;
  if (t === "health") { S.hp = Math.min(S.maxHp, S.hp + 25); floater(p.x, p.y, "+25 HP", "#a3e635"); sfx.power(); }
  else if (t === "weapon") {
    if (player.weapon < 3) { player.weapon++; floater(p.x, p.y, "WEAPON UP", "#fde047"); }
    else { player.overcharge = 10; floater(p.x, p.y, "OVERCHARGE", "#22d3ee", true); }
    sfx.power();
  }
  else if (t === "life") { S.lives++; floater(p.x, p.y, "+1 LIFE", "#f87171"); sfx.life(); }
  else if (t === "shield") { player.shield = 8; floater(p.x, p.y, "SHIELD", "#22d3ee"); sfx.power(); }
  else if (t === "rapid") { player.rapid = 10; floater(p.x, p.y, "RAPID FIRE", "#f0f"); sfx.power(); }
  else if (t === "drone") {
    if (player.drones < 2) { player.drones++; floater(p.x, p.y, "DRONE ONLINE", "#c084fc"); }
    else { addScore(500); floater(p.x, p.y, "+500", "#c084fc"); }
    sfx.power();
  }
  burst(p.x, p.y, "wht", 12, 200, 0.45, 10);
}

/* ── update ──────────────────────────────────────────────── */
function update(dt) {
  S.time += dt;

  /* player movement: keyboard, mouse-follow, or touch drag */
  let mx = 0, my = 0;
  if (keys.ArrowLeft || keys.KeyA) mx -= 1;
  if (keys.ArrowRight || keys.KeyD) mx += 1;
  if (keys.ArrowUp || keys.KeyW) my -= 1;
  if (keys.ArrowDown || keys.KeyS) my += 1;
  const focus = !!(keys.ShiftLeft || keys.ShiftRight); // focus: slow + precise
  const spd = player.speed * (focus ? 0.45 : 1);
  if (mx || my) {
    const d = Math.hypot(mx, my);
    player.x = clamp(player.x + mx / d * spd * dt, 24, W - 24);
    player.y = clamp(player.y + my / d * spd * dt, H * 0.22, H - 56);
  } else if (touchMode === "follow" && followId !== null) {
    // follow mode (mobile): ease toward the fingertip, mouse-style
    const k = Math.min(1, 10 * dt);
    player.x = clamp(lerp(player.x, followT.x, k), 24, W - 24);
    player.y = clamp(lerp(player.y, followT.y, k), H * 0.22, H - 56);
  } else if (performance.now() - mouse.t < 2500 && mouse.x > 0) {
    // mouse-follow: ease toward the pointer when the mouse is the last input
    const k = Math.min(1, 10 * dt);
    player.x = clamp(lerp(player.x, mouse.x, k), 24, W - 24);
    player.y = clamp(lerp(player.y, mouse.y, k), H * 0.22, H - 56);
  }
  if (player.inv > 0) player.inv -= dt;
  if (player.shield > 0) player.shield -= dt;
  if (player.rapid > 0) player.rapid -= dt;
  if (player.overcharge > 0) player.overcharge -= dt;

  /* drones orbit + fire */
  if (player.drones > 0) {
    player.droneA += 2.6 * dt;
    player.droneT -= dt;
    if (player.droneT <= 0) { player.droneT = 0.5; droneFire(); }
  }

  /* firing */
  player.fireT -= dt;
  const firing = keys.Space || mouse.down || touchFire || S.autoFire; // mobile: always auto-shooting
  if (firing && player.fireT <= 0) { player.fireT = fireInterval(); playerFire(); }

  /* combo decay */
  if (S.comboT > 0) {
    S.comboT -= dt;
    if (S.comboT <= 0) { S.streak = 0; S.mult = 1; }
  }
  /* graze budget refills (anti-farm cap) */
  S.grazeAcc = Math.max(0, S.grazeAcc - 320 * dt);

  /* player bullets: homing steer, pierce, ricochet */
  for (const b of pbullets) {
    if (!b.active) continue;
    if (b.hitCd > 0) b.hitCd -= dt;
    if (b.hom) {
      const tgt = nearestEnemy(b.x, b.y, 420, b.lastE);
      if (tgt) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, b.hom * dt);
        b.vx += (dx / d * sp - b.vx) * k;
        b.vy += (dy / d * sp - b.vy) * k;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -40 || b.x < -20 || b.x > W + 20 || b.y > H + 40) b.active = false;
  }

  /* enemy bullets + graze */
  const pr2 = (player.hitR + 4) * (player.hitR + 4); // tiny hitbox: skill over luck
  const gr2 = 34 * 34;
  for (const b of ebullets) {
    if (!b.active) continue;
    if (b.homing) { // steer toward the player, limited turn rate
      const dx = player.x - b.x, dy = player.y - b.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      const k = Math.min(1, 3.2 * dt);
      b.vx += (dx / d * sp - b.vx) * k;
      b.vy += (dy / d * sp - b.vy) * k;
      b.life -= dt;
      if (b.life <= 0) { b.active = false; continue; }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -30 || b.x < -20 || b.x > W + 20) { b.active = false; continue; }
    const d2 = (b.x - player.x) * (b.x - player.x) + (b.y - player.y) * (b.y - player.y);
    if (!b.grazed && d2 < gr2 && d2 > pr2) {
      b.grazed = true;
      S.grazes++;
      const g = 25 * S.mult;
      if (S.grazeAcc < 320) { // capped: no farming boss spirals forever
        const pay = Math.round(Math.min(g, 320 - S.grazeAcc));
        S.grazeAcc += pay;
        addScore(pay);
      }
      chargeBomb(4);
      // aggregate into one floater instead of spamming
      grazeAgg.n++; grazeAgg.pts += g;
      if (!grazeAgg.f || grazeAgg.f.life <= 0 || floaters.indexOf(grazeAgg.f) < 0) {
        grazeAgg.f = floater(player.x + 20, player.y - 22, "", "#7dd3fc");
      }
      grazeAgg.f.txt = "GRAZE ×" + grazeAgg.n + " +" + grazeAgg.pts;
      grazeAgg.f.life = 1;
      grazeAgg.f.x = clamp(player.x + 20, 60, W - 60);
      grazeAgg.f.y = player.y - 22;
      sfx.graze();
    }
    if (d2 < pr2) { b.active = false; hurtPlayer(b.dmg || 12, b.x, b.y); }
  }

  /* enemies */
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    let dead = false;

    // side-entry drift (ambush waves): slide in, then settle
    if (e.vx && e.type !== "boss" && !(e.type === "diver" && e.phase === 2)) {
      e.x += e.vx * dt;
      e.vx *= Math.max(0, 1 - 1.8 * dt);
    }

    // hoverers (sniper / mine-layer) retreat after ~20s so a wave can always end on its own
    if ((e.type === "sniper" || e.type === "minelayer") && !e.retreat && e.t > 20) e.retreat = true;

    if (e.type === "basic" || e.type === "splitter") {
      e.y += e.vy * dt;
      e.x += Math.sin(e.t * 2.2) * 24 * dt;
      if (S.wave >= 4) { // veterans open fire
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > 10 && e.y < H * 0.7) {
          e.fireT = rand(2.2, 3.4) * Math.pow(0.96, S.wave);
          enemyShoot(e.x, e.y + 14, ECFG[e.type].shotSpd, true, false, ECFG[e.type].shotDmg);
        }
      }
    } else if (e.type === "fast") {
      if (e.follow) {
        // snake formation: trail the ship ahead
        e.hist.unshift({ x: e.follow.x, y: e.follow.y });
        if (e.hist.length > 60) e.hist.pop();
        const tp = e.hist[14] || e.follow;
        const dx = tp.x - e.x, dy = tp.y - e.y, d = Math.hypot(dx, dy);
        if (d > 4) { const sp = 260; e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
      } else {
        e.y += e.vy * dt;
        e.x = e.sx + Math.sin(e.t * 3.4) * 90;
      }
    } else if (e.type === "tank") {
      e.y += e.vy * dt;
      e.fireT -= dt;
      if (e.fireT <= 0 && e.y > 10 && e.y < H * 0.7) {
        e.fireT = rand(1.1, 1.7) * Math.pow(0.96, S.wave);
        spreadShot(e.x, e.y + 18, 3, 0.24, ECFG.tank.shotSpd, ECFG.tank.shotDmg, false);
      }
    } else if (e.type === "diver") {
      if (e.phase === 0) {           // enter
        e.y += e.vy * dt;
        if (e.y > 130) { e.phase = 1; e.phaseT = 0.7; }
      } else if (e.phase === 1) {    // telegraph: track player
        e.phaseT -= dt;
        e.tx = player.x; e.ty = player.y;
        e.x += Math.sin(e.t * 30) * 30 * dt;
        if (e.phaseT <= 0) {
          e.phase = 2;
          const dx = e.tx - e.x, dy = e.ty - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.vx = dx / d * 430; e.vy = dy / d * 430;
          sfx.eshoot();
        }
      } else {                       // dive!
        e.x += e.vx * dt; e.y += e.vy * dt;
      }
    } else if (e.type === "sniper") {
      if (e.retreat) e.y -= 380 * dt;
      else if (e.y < 120) e.y += e.vy * dt;
      else {
        e.x = e.sx + Math.sin(e.t * 1.1) * Math.min(140, W * 0.3);
        e.fireT -= dt;
        if (e.fireT <= 0 && e.burst <= 0) { e.burst = 3; e.burstT = 0; }
      }
      if (!e.retreat && e.burst > 0) {
        e.burstT -= dt;
        if (e.burstT <= 0) { e.burst--; e.burstT = 0.14; enemyShoot(e.x, e.y + 14, ECFG.sniper.shotSpd, true, false, ECFG.sniper.shotDmg); }
      }
    } else if (e.type === "minelayer") {
      if (e.retreat) e.y -= 380 * dt;
      else if (e.y < 110) e.y += e.vy * dt;
      else {
        e.x += Math.sin(e.t * 0.9) * 60 * dt;
        e.mineT -= dt;
        if (e.mineT <= 0 && mineCount() < 4 && e.y < H * 0.5) {
          e.mineT = 2.4;
          spawnEnemy("mine", e.x, e.y + 18);
          sfx.eshoot();
        }
      }
    } else if (e.type === "mine") {
      e.y += e.vy * dt;
      e.fuse -= dt;
      if (e.fuse < 2) e.flash = 0.06; // blink warning before fizzling out
      if (e.fuse <= 0) { // mines fizzle on their own so they can't stall a wave
        burst(e.x, e.y, "mag", 6, 130, 0.35, 8);
        enemies[i] = enemies[enemies.length - 1]; enemies.pop(); continue;
      }
      // proximity fuse handled by ram check below
    } else if (e.type === "boss") {
      updateBoss(e, dt);
    }

    if (!dead && (e.y > H + 60 || (e.retreat && e.y < -70))) { enemies[i] = enemies[enemies.length - 1]; enemies.pop(); continue; }

    /* player bullets vs enemy */
    if (!dead) {
      const er = e.r;
      for (const b of pbullets) {
        if (!b.active) continue;
        if (b.hitCd > 0 && b.lastE === e) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (er + 5) * (er + 5)) {
          const wasPierce = b.pierce > 0;
          if (wasPierce) { b.pierce--; b.lastE = e; b.hitCd = 0.15; }
          else b.active = false;
          // ricochet: drone shots bounce to one more target
          if (b.rico) {
            b.rico = false;
            const nxt = nearestEnemy(b.x, b.y, 190, e);
            if (nxt) {
              const a = Math.atan2(nxt.y - b.y, nxt.x - b.x);
              const sp = Math.hypot(b.vx, b.vy) || 660;
              b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
              b.lastE = e; b.hitCd = 0.05;
              b.active = true;
            }
          }
          damageEnemy(e, b.dmg, b.x, b.y);
          if (e.hp <= 0) { enemies[i] = enemies[enemies.length - 1]; enemies.pop(); dead = true; }
          if (dead || !wasPierce) break;
        }
      }
    }

    /* enemy vs player (ram) */
    if (!dead && player.inv <= 0) {
      const rr = e.r + player.hitR - 4;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy < rr * rr) {
        hurtPlayer(e.type === "mine" ? 15 : 25, e.x, e.y);
        burst(e.x, e.y, "org", 12, 240, 0.5, 10);
        if (e.type === "boss") {
          // never remove the boss on ram — knock it back instead (no softlock)
          e.y = Math.max(70, e.y - 70);
          if (e.dash === 2) { e.dash = 3; e.dashT = 0.5; e.vx = 0; e.vy = 0; }
        } else {
          enemies[i] = enemies[enemies.length - 1]; enemies.pop();
        }
        continue;
      }
    }
  }

  /* powerups: drift, magnet, pickup, expire */
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.t += dt; p.life -= dt;
    p.y += 70 * dt;
    const dx = player.x - p.x, dy = player.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 110 && d > 1) { p.x += dx / d * 260 * dt; p.y += dy / d * 260 * dt; }
    if (p.y > H + 30 || p.life <= 0) { powerups.splice(i, 1); continue; }
    if (d < 30) { applyPowerup(p); powerups.splice(i, 1); }
  }

  /* particles / floaters / rings */
  for (const p of parts) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.drag; p.vy *= p.drag;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt * 0.9; f.y -= 46 * dt;
    if (f.life <= 0) floaters.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt * 1.6;
    r.r = lerp(r.maxR, 6, Math.max(0, r.life));
    if (r.life <= 0) rings.splice(i, 1);
  }

  /* stars */
  for (const s of stars) {
    s.y += s.sp * dt * (1 + S.wave * 0.04);
    if (s.y > H + 4) { s.y = -4; s.x = rand(0, W); }
  }

  director(dt);

  /* decay juice */
  S.trauma = Math.max(0, S.trauma - dt * 1.6);
  S.redFlash = Math.max(0, S.redFlash - dt * 1.8);
  if (S.bannerT > 0) {
    S.bannerT -= dt;
    if (S.bannerT <= 0) banner.classList.add("hidden");
  }

  syncHud();
}

/* ── hud sync (only touches DOM on change) ───────────────── */
let lastHud = { hp: -1, lives: -1, waveF: -1, chips: "", pips: "", bossHp: -1, bomb: -1 };
const CHIP_DEF = [
  ["rapid", "RAPID", "#f0f"],
  ["shield", "SHIELD", "#22d3ee"],
  ["overcharge", "OVERCHARGE", "#7dd3fc"],
];
function syncHud() {
  const hpP = Math.round(S.hp / S.maxHp * 100);
  if (hpP !== lastHud.hp) {
    lastHud.hp = hpP;
    healthFill.style.width = hpP + "%";
    healthWrap.classList.toggle("low", hpP <= 30);
  }
  if (S.lives !== lastHud.lives) { lastHud.lives = S.lives; livesEl.textContent = S.lives; }
  const wf = waveProgress();
  if (Math.abs(wf - lastHud.waveF) > 0.005) { lastHud.waveF = wf; waveFill.style.width = (wf * 100).toFixed(1) + "%"; }
  // active power-up chips with timer bars
  let ck = "";
  for (const [k] of CHIP_DEF) if (player[k] > 0) ck += k + Math.ceil(player[k]);
  if (ck !== lastHud.chips) {
    lastHud.chips = ck;
    let html = "";
    for (const [k, label, col] of CHIP_DEF) {
      if (player[k] <= 0) continue;
      const max = k === "rapid" ? 10 : k === "shield" ? 8 : 10;
      const pct = clamp(player[k] / max * 100, 0, 100).toFixed(0);
      html += '<div class="chip" style="--cc:' + col + '"><span>' + label + '</span>' +
              '<div class="chip-track"><div class="chip-fill" style="width:' + pct + '%"></div></div></div>';
    }
    chipsEl.innerHTML = html;
  }
  // weapon-level pips + drone pips
  const pk = "w" + player.weapon + "d" + player.drones + (player.overcharge > 0 ? "o" : "");
  if (pk !== lastHud.pips) {
    lastHud.pips = pk;
    let html = '<span class="pips-label">GUN</span>';
    for (let k = 1; k <= 3; k++) html += '<i class="pip' + (k <= player.weapon ? " on" : "") + (player.overcharge > 0 ? " oc" : "") + '"></i>';
    if (player.drones > 0) {
      html += '<span class="pips-label">DRN</span>';
      for (let k = 1; k <= 2; k++) html += '<i class="pip drone' + (k <= player.drones ? " on" : "") + '"></i>';
    }
    wpipsEl.innerHTML = html;
  }
  // bomb button charge state
  const br = S.bomb >= 100 ? 2 : S.bomb >= 50 ? 1 : 0;
  if (br !== lastHud.bomb) {
    lastHud.bomb = br;
    bombBtn.classList.toggle("ready", S.bomb >= 100);
    if (bombBtn.style.setProperty) bombBtn.style.setProperty("--bp", Math.round(S.bomb) + "%");
  }
  if (S.boss) {
    const bp = S.boss.hp / S.boss.maxHp;
    if (Math.abs(bp - lastHud.bossHp) > 0.004) { lastHud.bossHp = bp; bossFill.style.width = (bp * 100).toFixed(1) + "%"; }
  }
}

/* ── render ──────────────────────────────────────────────── */
function ebSprite(b) {
  if (b.homing) return SPR.ebT;                       // homing: triangle
  if (b.boss || b.dmg >= 16) return (b.dmg >= 16 && !b.boss) ? SPR.ebD : SPR.ebM; // heavy: diamond / boss: magenta
  return SPR.ebR;                                      // normal: red orb
}
function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (S.trauma > 0) {
    const s = S.trauma * S.trauma * 22;
    ctx.translate(rand(-s, s), rand(-s, s));
  }

  if (nebulaCv) ctx.drawImage(nebulaCv, 0, 0, W, H);
  ctx.fillStyle = "#c8dcff";
  for (const st of stars) {
    ctx.globalAlpha = st.a;
    ctx.fillRect(st.x, st.y, st.sz, st.sz * 2.2);
  }
  ctx.globalAlpha = 1;

  if (S.running || S.paused) {
    // powerups
    for (const p of powerups) {
      if (p.life < 2 && Math.floor(p.life * 8) % 2 === 0) continue; // expiry blink
      const bob = Math.sin(p.t * 5) * 3;
      blit(SPR.pow[p.type], p.x, p.y + bob);
    }
    // ── additive glow layer: bullets, trails, particles ──
    ctx.globalCompositeOperation = "lighter";
    // enemy bullets: shape-coded by type + motion trails
    for (const b of ebullets) {
      if (!b.active) continue;
      const ang = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      blit(SPR.trail, b.x, b.y, ang);
      blit(ebSprite(b), b.x, b.y);
    }
    // player bullets
    for (const b of pbullets) {
      if (!b.active) continue;
      blit(b.laser ? SPR.laser : SPR.bullet, b.x, b.y, b.vx ? Math.atan2(b.vy, b.vx) + Math.PI / 2 : 0);
    }
    // engine flame flicker
    if (!(player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0)) {
      const fl = 10 + Math.random() * 10;
      const fg = ctx.createRadialGradient(player.x, player.y + 30, 0, player.x, player.y + 30, fl);
      fg.addColorStop(0, "rgba(180,240,255,0.9)");
      fg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(player.x, player.y + 30, fl, 0, TAU); ctx.fill();
    }
    // particles
    for (const p of parts) {
      if (!p.active) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      const s = p.size;
      ctx.drawImage(p.spr.c, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // enemies
    for (const e of enemies) {
      let spr, sc = 1;
      if (e.type === "boss") {
        spr = SPR[e.def.spr + (e.flash > 0 ? "F" : "")];
        sc = e.mini ? 0.55 : 1;
      } else spr = e.flash > 0 ? SPR[e.type + "F"] : SPR[e.type];
      let rot = 0;
      if (e.type === "diver" && e.phase === 2) rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      if (e.type === "boss" && e.dash === 2) rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      if (e.type === "diver" && e.phase === 1 && Math.floor(e.t * 14) % 2 === 0) {
        blit(SPR.diverF, e.x, e.y); // telegraph flash
      } else if (sc !== 1) blitS(spr, e.x, e.y, sc, rot);
      else blit(spr, e.x, e.y, rot);
      if (e.sh > 0) blit(SPR.eshield, e.x, e.y, e.t * 0.8); // shielded enemy ring
      if (e.type === "mine") { // proximity pulse
        ctx.globalAlpha = 0.35 + Math.sin(e.t * 10) * 0.2;
        ctx.strokeStyle = "#f87171"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, 26 + Math.sin(e.t * 10) * 4, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if ((e.type === "tank" || e.type === "sniper" || e.type === "splitter" || e.type === "minelayer" ||
           (e.type === "boss" && e.mini)) && e.hp < e.maxHp) {
        const w = 30;
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
        ctx.fillStyle = "#fb923c";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * (e.hp / e.maxHp), 4);
      }
    }
    // player
    if (!(player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0)) {
      blit(SPR.player, player.x, player.y);
      // hitbox dot: tiny, always visible — the real hitbox
      const focusing = keys.ShiftLeft || keys.ShiftRight;
      ctx.fillStyle = focusing ? "#22d3ee" : "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(player.x, player.y - 2, focusing ? 3.4 : 2.4, 0, TAU); ctx.fill();
      if (focusing) {
        ctx.strokeStyle = "rgba(34,211,238,0.8)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(player.x, player.y - 2, 8, 0, TAU); ctx.stroke();
      }
      if (player.shield > 0) {
        ctx.globalAlpha = 0.65 + Math.sin(S.time * 8) * 0.2;
        blit(SPR.shield, player.x, player.y);
        ctx.globalAlpha = 1;
      }
    }
    // orbiting drones
    for (let d = 0; d < player.drones; d++) {
      const a = player.droneA + d * Math.PI;
      blit(SPR.drone, player.x + Math.cos(a) * 56, player.y + Math.sin(a) * 56, a + Math.PI / 2);
    }
    // shockwave rings
    for (const r of rings) {
      ctx.globalAlpha = clamp(r.life, 0, 1) * 0.9;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // floating texts
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = f.big ? "900 22px Orbitron, sans-serif" : "700 15px Orbitron, sans-serif";
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    // compact combo meter near the ship (not stranded in a corner)
    if (S.mult > 1) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "900 14px Orbitron, sans-serif";
      ctx.fillStyle = S.mult >= 6 ? "#fbbf24" : "#f0f";
      ctx.fillText("×" + S.mult, player.x, player.y + 46);
      const bw = 46;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(player.x - bw / 2, player.y + 56, bw, 3);
      ctx.fillStyle = "#f0f";
      ctx.fillRect(player.x - bw / 2, player.y + 56, bw * clamp(S.comboT / 2.5, 0, 1), 3);
    }
  }

  ctx.restore();

  if (vigCv) ctx.drawImage(vigCv, 0, 0, W, H);
  if (S.redFlash > 0) {
    ctx.fillStyle = `rgba(220,30,30,${(S.redFlash * 0.35).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (S.running && S.hp <= 30 && S.hp > 0) {
    const a = 0.10 + Math.sin(S.time * 6) * 0.06;
    const g2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g2.addColorStop(0, "rgba(220,30,30,0)");
    g2.addColorStop(1, `rgba(220,30,30,${a.toFixed(3)})`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ── main loop (dt-based: same speed on 60Hz and 120Hz) ─── */
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  if (!S.running || S.paused) { render(); return; }
  if (S.hitStop > 0) { S.hitStop -= rdt; render(); return; }
  update(rdt);
  render();
}

/* ── game flow ───────────────────────────────────────────── */
function resetPools() {
  for (const p of pbullets) p.active = false;
  for (const p of ebullets) p.active = false;
  for (const p of parts) p.active = false;
  enemies.length = 0; powerups.length = 0; floaters.length = 0; rings.length = 0;
}
function startGame() {
  initAudio();
  if (AC && AC.state === "suspended") AC.resume();
  lockScreen(); buzz(20);
  R = Math.random;
  Object.assign(S, {
    running: true, paused: false,
    score: 0, wave: 1, lives: 3, hp: 75,
    time: 0, kills: 0, streak: 0, comboT: 0, mult: 1, maxMult: 1,
    grazes: 0, grazeAcc: 0, shots: 0, hits: 0,
    spawned: 0, quota: 0, spawnT: 0,
    bossWave: false, bossWarn: 0, boss: null,
    theme: null, lastTheme: null, bag: null, mods: [], rogue: false,
    waveBreak: 0, waveBonus: 0,
    bomb: 0,
    trauma: 0, redFlash: 0, hitStop: 0, bannerT: 0,
    bestStart: S.best,
  });
  Object.assign(player, {
    x: W / 2, y: H - 110, fireT: 0, weapon: 1, inv: 1.5, shield: 0, rapid: 0,
    overcharge: 0, drones: 0, droneA: 0, droneT: 0,
  });
  grazeAgg.n = 0; grazeAgg.pts = 0; grazeAgg.f = null;
  music.step = 0;
  resetPools();
  lastHud = { hp: -1, lives: -1, waveF: -1, chips: "", pips: "", bossHp: -1, bomb: -1 };
  scoreEl.textContent = "0";
  bestEl.textContent = S.best;
  bossBar.classList.add("hidden");
  banner.classList.add("hidden");
  startScreen.classList.add("hidden");
  overScreen.classList.add("hidden");
  pauseScreen.classList.add("hidden");
  hud.classList.remove("hidden");
  healthWrap.classList.remove("hidden");
  let coarse = false;
  try { coarse = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches); } catch (e) {}
  S.autoFire = coarse; // mobile only: auto-shooting, no FIRE button needed
  fireBtn.classList.add("hidden");
  if (coarse) bombBtn.classList.remove("hidden");
  startWave(1);
  sfx.start();
  syncHud();
}
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return m + ":" + String(ss).padStart(2, "0");
}
function gameOver() {
  S.running = false;
  S.overAt = Date.now();
  unlockScreen();
  buzz([70, 50, 70]);
  sfx.over();
  const isBest = S.score > (S.bestStart || 0) && S.score > 0;
  if (S.score > S.best) {
    S.best = S.score;
    store.set("sfBest", String(S.best));
  }
  $("finalScore").textContent = S.score;
  $("finalBest").textContent = S.best;
  $("statWave").textContent = S.wave;
  $("statKills").textContent = S.kills;
  $("statCombo").textContent = "×" + S.maxMult;
  $("statAcc").textContent = (S.shots ? Math.round(S.hits / S.shots * 100) : 0) + "%";
  $("statGraze").textContent = S.grazes;
  $("statTime").textContent = fmtTime(S.time);
  // "so close" driver: how far off the best, plus a rank
  const shortBy = S.best - S.score;
  $("shortBy").textContent = (!isBest && shortBy > 0) ? shortBy + " short of your best" : "";
  $("rankLetter").textContent = computeRank(S.score);
  $("rankLabel").textContent = "pilot rank";
  $("newBestBadge").classList.toggle("hidden", !isBest);
  hud.classList.add("hidden");
  healthWrap.classList.add("hidden");
  fireBtn.classList.add("hidden");
  bombBtn.classList.add("hidden");
  bossBar.classList.add("hidden");
  banner.classList.add("hidden");
  overScreen.classList.remove("hidden");
}
function toMenu() {
  S.running = false; S.paused = false;
  unlockScreen();
  pauseScreen.classList.add("hidden");
  overScreen.classList.add("hidden");
  hud.classList.add("hidden");
  healthWrap.classList.add("hidden");
  bossBar.classList.add("hidden");
  banner.classList.add("hidden");
  bombBtn.classList.add("hidden");
  bestEl.textContent = S.best;
  $("bestStart").textContent = S.best;
  startScreen.classList.remove("hidden");
  sfx.click();
}
function pauseGame(force) {
  if (!S.running || S.paused) return;
  if (force === false) return;
  S.paused = true;
  pauseScreen.classList.remove("hidden");
  unlockScreen();
  sfx.pause();
}
function resumeGame() {
  if (!S.running || !S.paused) return;
  S.paused = false;
  pauseScreen.classList.add("hidden");
  lockScreen();
  sfx.click();
}
function togglePause() {
  if (!S.running) return;
  if (S.paused) resumeGame(); else pauseGame();
}
function toggleMute() {
  initAudio();
  muted = !muted;
  store.set("sfMuted", muted ? "1" : "0");
  btnMute.classList.toggle("muted", muted);
  if (master) master.gain.value = muted ? 0 : 0.28 * volume;
}
function setVolume(v) {
  volume = clamp(v, 0, 1);
  store.set("sfVol", String(volume));
  if (master) master.gain.value = muted ? 0 : 0.28 * volume;
}

/* ── ui wiring ─────────────────────────────────────────────── */
btnStart.addEventListener("click", () => { initAudio(); sfx.click(); startGame(); });
if (document.querySelectorAll) {
  document.querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => { initAudio(); sfx.click(); setTouchMode(b.dataset.tm); }));
}
btnRestart.addEventListener("click", () => {
  if (Date.now() - S.overAt < 800) return;
  initAudio(); sfx.click(); startGame();
});
btnRestartP.addEventListener("click", () => { initAudio(); sfx.click(); startGame(); });
btnQuit.addEventListener("click", toMenu);
const btnMenu = $("btnMenu");
if (btnMenu) btnMenu.addEventListener("click", toMenu);
btnResume.addEventListener("click", resumeGame);
btnPause.addEventListener("click", () => { initAudio(); togglePause(); });
btnMute.addEventListener("click", toggleMute);
volSlider.addEventListener("input", () => setVolume(parseFloat(volSlider.value)));
motionChk.addEventListener("change", () => {
  reduceMotion = motionChk.checked;
  store.set("sfMotion", reduceMotion ? "1" : "0");
});

/* ── boot ──────────────────────────────────────────────────── */
buildSprites();
resize();
bestEl.textContent = S.best;
$("bestStart").textContent = S.best;
btnMute.classList.toggle("muted", muted);
volSlider.value = volume;
motionChk.checked = reduceMotion;
setTouchMode(touchMode); // paint the saved steer mode on the seg buttons
requestAnimationFrame(frame);

/* debug / test hook — only with ?debug (keeps leaderboards honest) */
try {
  if (window.location && window.location.search && window.location.search.indexOf("debug") >= 0) {
    window.__sf = {
      S, player, enemies, pbullets, ebullets, parts, powerups, floaters,
      startGame, gameOver, pauseGame, resumeGame, toggleMute, togglePause, toMenu,
      spawnEnemy, spawnBoss, spawnV, spawnSnake, bossForWave, BOSS_DEFS, THEMES, pickType,
      damageEnemy, hurtPlayer, addScore, applyPowerup, enemyShoot, spreadShot,
      fireBomb, chargeBomb, updateBoss, bossAttack, minisAlive, spawnCompanion,
      update, director, startWave, syncHud, calcMult, computeRank,
      setRng: (fn) => { R = fn; }, getRng: () => R, mulberry32,
      setTouchMode, get touchMode() { return touchMode; },
    };
  }
} catch (e) {}
