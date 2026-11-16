NEON SERPENT — a Snake game with teeth
============================================

Just open index.html in any browser. No build step, no dependencies,
works offline (Google Fonts are optional enhancement with fallbacks).

WHAT'S NEW vs the original
--------------------------
LOOKS
- Canvas renderer (was: DOM grid divs) — buttery interpolated movement,
  neon glow snake with gradient body + eyes that look where you're going
- Pulsing food with glossy highlight, screen shake + red flash on crash,
  particle bursts on every eat, floating "+points" text
- Dark arcade UI: glassmorphism HUD, animated gradient title, ambient
  background orbs, game-over panel with stats

ADDICTIVE GAMEPLAY
- Combo system: eat again within ~4 seconds to multiply points (up to x8),
  with a draining combo meter pill
- Golden apples: rare, expire in 6 seconds (countdown ring), worth 25 x combo
- Speed ramp: the snake gets faster with every food you eat
- Juice everywhere: score pop animation, NEW BEST confetti celebration,
  synth sound effects (Web Audio, no files needed)

CONTROLS
- Arrows / WASD to steer (quick turns are buffered so fast input isn't lost)
- Space: start / pause / restart — P or Esc pauses, M mutes
- Swipe to steer on touch screens
- Auto-pauses when the tab loses focus

FILES
- index.html  — structure + overlays (start / game over / pause)
- style.css   — all visuals
- game.js     — engine (fixed-timestep sim, canvas render, SFX)

High score and mute preference persist in localStorage.
