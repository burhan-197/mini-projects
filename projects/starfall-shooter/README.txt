STARFALL
============================================
A canvas space shooter. Hold the line, chain kills, don't get hit.

HOW TO PLAY
  Move:  WASD / arrow keys (full 2D movement), or move the mouse to
         steer the ship toward it
  Fire:  hold Space or hold the mouse button
  Focus: hold Shift - slow precise movement, hitbox dot visible
  Bomb:  B (desktop) or the BOMB button (mobile) when the charge bar
         is full. Bomb charge builds from kills and grazes.
  Pause: P or Esc (also auto-pauses when the tab loses focus)
  Mute:  M
  Mobile: two steering styles, switchable on the start screen or in
         the pause menu (mobile only) - DRAG moves the ship relative
         to your finger, FOLLOW glides it toward your fingertip like
         a mouse. Auto-fire is always on for both.

SCORE SYSTEM
  Each enemy type pays base points multiplied by your combo:
    basic 100 · fast 150 · diver 200 · sniper 250 · tank 300
    splitter 200 · mine-layer 250 · mine 50
    mini-boss 800 · boss 2000-3000 (+tier bonus)
  Kill streaks build a combo multiplier up to x8. Kills must keep
  coming (within ~2.5s) or the combo resets. Taking an unshielded
  hit drops the combo one step.
  Graze: skim past enemy bullets for +25 x combo (rate-capped - you
  can't farm a boss spiral forever).
  Clearing a wave pays a 150 x wave-number bonus.
  Your best score is saved on this device. Beat it for a NEW BEST
  badge. Game over shows your rank (S/A/B/C/D) and how far short
  of your best you fell.

MODES
  LAUNCH - endless run. Survive, chain kills, beat your best.

BOMB
  Clears every hostile bullet and hits all on-screen enemies.
  Charges 6 per kill, 1 per graze, 25 per wave clear.
  A warning flash + sound tells you when it's ready.
  Bomb damage vs a boss is capped at 30% of the boss's max HP -
  bombs help in a boss fight but can't skip one. Boss minions
  (adds) still take the full hit.

WAVES
  Snipers and mine-layers retreat off the top of the screen if
  they survive ~20s, and stray mines fizzle out after 15s, so a
  wave can always end on its own even if you ignore them.

POWERUPS (drop from kills, timed ones show countdown chips in HUD)
  +   heal 25 HP        W   weapon upgrade (up to level 5)
  +1  extra life        S   shield (8s, absorbs hits)
  R   rapid fire (10s)
  Weapon levels change behavior: level 3 center shot pierces,
  level 4 side shots home in, level 5 grants 10s overcharge
  piercing lasers. Max-level W pickups refresh overcharge.
  Drone pickups (unlisted, rare): up to 2 orbiting drones that
  fire ricocheting shots.

ENEMIES
  basic / fast / tank plus:
  diver      - telegraphs, then dives straight at you
  sniper     - strafes at the top, fires aimed 3-round heavy bursts
  splitter   - breaks into 3 fast enemies when destroyed
  mine-layer - drops proximity mines that arm and detonate
  Variants: shielded enemies need extra shots; heavy bullet rounds
  travel faster; V and snake formations fly in.

WAVES
  Every wave has a theme (SWARM, ARMORED COLUMN, AMBUSH,
  CROSSFIRE, SURGE, FIRST CONTACT on wave 1) with different enemy
  mixes; some flank you from the sides. Never the same theme
  twice in a row.

BOSSES (every 3rd wave, each with its own look and weapons)
  WARDEN (wave 3)  - hexagonal fortress: aimed 5-fans, bullet rings,
                     summons reinforcements
  LANCER (wave 6)  - strike dart: rapid aimed bursts, sweeping beam
                     arcs, telegraphed charges
  HIVE   (wave 9)  - pod carrier: spiral barrages, homing missiles,
                     hatches divers
  Bosses ENRAGE at half HP: 1.3s invulnerable transition, then
  faster, deadlier patterns. Bosses return stronger every cycle
  (more HP, faster fire, extra weapons). Demoted bosses sometimes
  assist bigger bosses as companions, or ambush you mid-wave as
  a ROGUE SIGNAL.
  Boss shots are shape-coded: circles and aimed diamonds are
  standard, heavy MAGENTA rounds (squares/octagons) hit harder.

GAME OVER SCREEN STATS
  wave reached, kills, best combo, accuracy, grazes, time survived.

ACCESSIBILITY
  Pause menu has volume slider and a Reduce Motion toggle (cuts
  shake, flashes, and particle counts).

OPTIMIZATIONS
  - All sprites pre-rendered once to offscreen canvases (no per-frame
    gradients or path drawing for ships/bullets/particles)
  - Fixed-size object pools for bullets and particles (no per-frame
    allocation, swap-remove instead of filter())
  - Canvas pixel ratio capped at 2x
  - dt-based simulation: identical speed on 60Hz and 120Hz screens
  - DOM HUD only updates on value change

FILES
  index.html - markup + HUD + overlays
  style.css  - all UI styling
  game.js    - engine (no dependencies, works offline except fonts)

TIP
  Serve over http(s) or just open index.html. No build step.
  Append ?debug to the URL to expose window.__sf for testing.
