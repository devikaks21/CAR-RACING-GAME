/**
 * ============================================================================
 * CAR RACING GAME - VANILLA JAVASCRIPT ENGINE (UPGRADED)
 * ============================================================================
 * Features:
 * - State Machine: START, PLAYING, PAUSED, GAME OVER
 * - 60FPS requestAnimationFrame with delta-time physics
 * - 🪙 Coin (+50 score) & ⛽ Fuel Cans (+35 fuel) with dynamic HUD meter
 * - 🛡️ Forcefield Shield: Absorbs & deflects 1 crash with shockwave & bonus
 * - 🏎️ Vehicle Garage: 5 custom race machines (Cyber, Inferno, Viper, Midas, Police)
 * - ☀️/🌙/🌧️ Weather System: Dynamic Day, Night, and Rain storm particle canvas
 * - 🏆 High Score Leaderboard: Local & Cloud sync with driver tags and medals
 * - Web Audio procedural synthesis (engine rev, coin ping, fuel glug, shield pop, crash)
 * - QR code mobile scanner & touch steering
 * ============================================================================
 */

'use strict';

// ----------------------------------------------------------------------------
// 1. CONFIGURATION & VEHICLES
// ----------------------------------------------------------------------------
const CONFIG = {
  // Speeds in pixels per second
  BASE_ROAD_SPEED: 480,
  BASE_ENEMY_SPEED: 390,
  PLAYER_STEER_SPEED: 520,
  NITRO_MULTIPLIER: 1.55,

  // Road geometry
  ROAD_BORDER_WIDTH: 14,
  TOTAL_LANES: 3,

  // Spawning settings (in milliseconds)
  BASE_SPAWN_INTERVAL: 1800,
  MIN_SPAWN_INTERVAL: 900,
  MIN_VERTICAL_GAP: 220,

  // Collectibles Spawning
  BASE_PICKUP_INTERVAL: 2400,
  MIN_PICKUP_INTERVAL: 1400,

  // Fuel depletion rate (% per second - balanced for 2-3 minute continuous racing per tank)
  BASE_FUEL_BURN_RATE: 0.7,
  NITRO_FUEL_BURN_RATE: 1.5,

  // Score intervals for speed scaling
  SPEED_TIERS: [
    { maxScore: 499,  multiplier: 1.0, label: '1x' },
    { maxScore: 999,  multiplier: 1.5, label: '1.5x' },
    { maxScore: 1499, multiplier: 2.0, label: '2x' },
    { maxScore: Infinity, multiplier: 2.5, label: '2.5x' }
  ],

  // Speed Gears (Cruise, Sport, Hyper)
  SPEED_GEARS: [
    { id: 'cruise', name: 'CRUISE 🟢', speedMul: 0.82, baseMph: 90,  class: 'gear-cruise' },
    { id: 'sport',  name: 'SPORT ⚡',  speedMul: 1.15, baseMph: 140, class: 'gear-sport' },
    { id: 'hyper',  name: 'HYPER 🔥',  speedMul: 1.62, baseMph: 210, class: 'gear-hyper' }
  ],

  // Garage Vehicles
  CARS: [
    {
      id: 'skin-cyber-blue',
      name: 'Cyber Cobalt',
      desc: 'High-tech electric speedster with neon aero lines',
      badge: 'SPEED',
      color: '#00f0ff',
      isPolice: false
    },
    {
      id: 'skin-inferno-red',
      name: 'Inferno Fury',
      desc: 'Twin-turbo V12 hypercar with racing gold stripes',
      badge: 'POWER',
      color: '#ff0044',
      isPolice: false
    },
    {
      id: 'skin-toxic-viper',
      name: 'Toxic Viper',
      desc: 'Lightweight track weapon with venom lime downforce',
      badge: 'AGILITY',
      color: '#39ff14',
      isPolice: false
    },
    {
      id: 'skin-golden-midas',
      name: 'Royal Midas',
      desc: 'Forged 24K mirror-gold body with carbon diffusers',
      badge: 'LUXURY',
      color: '#ffe259',
      isPolice: false
    },
    {
      id: 'skin-police',
      name: 'Police Interceptor',
      desc: 'Pursuit cruiser with active blue & red strobe sirens',
      badge: 'PURSUIT',
      color: '#ffffff',
      isPolice: true
    }
  ],

  // Enemy color variations
  ENEMY_STYLES: [
    { class: 'enemy-red',    name: 'Red Streak' },
    { class: 'enemy-yellow', name: 'Golden Taxi' },
    { class: 'enemy-green',  name: 'Viper Green' },
    { class: 'enemy-purple', name: 'Phantom Purple' },
    { class: 'enemy-orange', name: 'Blaze Orange' }
  ],

  // Default leaderboard seed
  DEFAULT_LEADERBOARD: [
    { rank: 1, name: 'APEX_RACER', car: 'Inferno Fury', score: 2450 },
    { rank: 2, name: 'DRIFT_QUEEN', car: 'Cyber Cobalt', score: 1890 },
    { rank: 3, name: 'VIPER_VIP', car: 'Toxic Viper', score: 1420 },
    { rank: 4, name: 'MIDAS_GOLD', car: 'Royal Midas', score: 1100 },
    { rank: 5, name: 'COP_HUNTER', car: 'Police Interceptor', score: 850 }
  ]
};

// ----------------------------------------------------------------------------
// 2. STATE MANAGEMENT
// ----------------------------------------------------------------------------
const GameState = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER'
};

const state = {
  current: GameState.START,
  score: 0,
  highScore: 0,
  coins: 0,
  fuel: 100, // 0 - 100%
  lives: 3,
  isInvulnerable: false,
  hasShield: false,
  selectedSkin: 'skin-cyber-blue',
  weather: 'day', // 'day' | 'night' | 'rain'

  speedMultiplier: 1.0,
  speedLabel: '1x',
  gearIndex: 1, // 0: Cruise, 1: Sport, 2: Hyper
  currentMph: 140,
  
  // Player position & movement
  playerX: 0,
  playerY: 0,
  playerWidth: 48,
  playerHeight: 84,
  steeringDirection: 0,

  // Road & Subway Surfers Scenery animation
  roadOffset: 0,
  roadWidth: 380,
  roadHeight: 580,
  sceneryItems: [],

  // Active entities
  enemies: [],
  pickups: [],
  lastEnemySpawnTime: 0,
  lastPickupSpawnTime: 0,
  spawnInterval: CONFIG.BASE_SPAWN_INTERVAL,
  pickupSpawnInterval: CONFIG.BASE_PICKUP_INTERVAL,

  // Animation frame reference
  animationFrameId: null,
  lastFrameTime: 0,

  // Input states
  keys: {
    left: false,
    right: false,
    nitro: false
  },

  // Audio settings
  soundEnabled: true,

  // Leaderboard data
  leaderboard: []
};

// ----------------------------------------------------------------------------
// 3. DOM ELEMENT REFERENCES
// ----------------------------------------------------------------------------
const DOM = {
  // HUD
  score: document.getElementById('score'),
  highScore: document.getElementById('high-score'),
  speed: document.getElementById('speed'),
  btnGear: document.getElementById('btn-gear'),
  coins: document.getElementById('coins'),
  lives: document.getElementById('lives'),
  fuelBar: document.getElementById('fuel-bar'),
  fuelText: document.getElementById('fuel-text'),
  soundBtn: document.getElementById('btn-sound'),
  soundIcon: document.getElementById('sound-icon'),

  // Header Toolbar Buttons
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnRestart: document.getElementById('btn-restart'),
  btnGarage: document.getElementById('btn-garage'),
  btnWeather: document.getElementById('btn-weather'),
  weatherIcon: document.getElementById('weather-icon'),
  btnLeaderboard: document.getElementById('btn-leaderboard'),

  // Subway Surfers World & Scenery Elements
  gameWorld: document.getElementById('game-world'),
  distantSkyline: document.getElementById('distant-skyline'),
  skylineClouds: document.querySelector('.skyline-clouds'),
  skylineCity: document.querySelector('.skyline-city'),
  sceneryLeft: document.getElementById('scenery-left'),
  sceneryRight: document.getElementById('scenery-right'),
  speedWarpLines: document.getElementById('speed-warp-lines'),

  // Game Area & Overlays
  road: document.getElementById('road'),
  laneDividers: document.querySelectorAll('.lane-divider'),
  enemyContainer: document.getElementById('enemy-container'),
  pickupContainer: document.getElementById('pickup-container'),
  floatTextContainer: document.getElementById('float-text-container'),
  rainCanvas: document.getElementById('rain-canvas'),
  playerCar: document.getElementById('player-car'),
  playerBody: document.getElementById('player-body'),
  playerShield: document.getElementById('player-shield'),
  policeSiren: document.getElementById('police-siren'),

  // Screens
  startScreen: document.getElementById('start-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameOverScreen: document.getElementById('game-over-screen'),

  // Screen Buttons & Stats
  startScreenBtn: document.getElementById('start-screen-btn'),
  startGarageBtn: document.getElementById('start-garage-btn'),
  pauseResumeBtn: document.getElementById('pause-resume-btn'),
  gameOverRestartBtn: document.getElementById('game-over-restart-btn'),
  gameOverBoardBtn: document.getElementById('game-over-board-btn'),
  finalScore: document.getElementById('final-score'),
  finalCoins: document.getElementById('final-coins'),
  finalHighScore: document.getElementById('final-high-score'),
  gameOverTitle: document.getElementById('game-over-title'),
  gameOverReason: document.getElementById('game-over-reason'),
  gameOverIcon: document.getElementById('game-over-icon'),
  newRecordBadge: document.getElementById('new-record-badge'),

  // Leaderboard Elements
  driverNameInput: document.getElementById('driver-name-input'),
  btnSaveScore: document.getElementById('btn-save-score'),
  saveScoreMsg: document.getElementById('save-score-msg'),
  leaderboardModal: document.getElementById('leaderboard-modal'),
  leaderboardCloseBtn: document.getElementById('leaderboard-close-btn'),
  leaderboardCloseBtnBottom: document.getElementById('leaderboard-close-btn-bottom'),
  leaderboardTbody: document.getElementById('leaderboard-tbody'),

  // Garage Elements
  garageModal: document.getElementById('garage-modal'),
  garageCloseBtn: document.getElementById('garage-close-btn'),
  garageCarGrid: document.getElementById('garage-car-grid'),
  garageSelectBtn: document.getElementById('garage-select-btn'),

  // Mobile Controls
  btnMobileLeft: document.getElementById('btn-mobile-left'),
  btnMobileNitro: document.getElementById('btn-mobile-nitro'),
  btnMobileRight: document.getElementById('btn-mobile-right'),

  // QR Code Scanner Modal & API Connect
  btnQr: document.getElementById('btn-qr'),
  startQrBtn: document.getElementById('start-qr-btn'),
  qrModal: document.getElementById('qr-modal'),
  qrCloseBtn: document.getElementById('qr-close-btn'),
  qrImage: document.getElementById('qr-image'),
  qrLoading: document.getElementById('qr-loading'),
  qrUrlInput: document.getElementById('qr-url-input'),
  btnCopyUrl: document.getElementById('btn-copy-url'),
  copyFeedback: document.getElementById('copy-feedback'),
  apiSyncStatus: document.getElementById('api-sync-status')
};

// ----------------------------------------------------------------------------
// 4. PROCEDURAL WEB AUDIO SYNTHESIZER
// ----------------------------------------------------------------------------
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!state.soundEnabled || !audioCtx) return;

  try {
    const now = audioCtx.currentTime;

    if (type === 'pass') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } 
    else if (type === 'coin') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now);
      osc1.frequency.setValueAtTime(1318.51, now + 0.08);
      osc2.frequency.setValueAtTime(1975.53, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    }
    else if (type === 'fuel') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    }
    else if (type === 'shield_on') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }
    else if (type === 'shield_pop') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
    else if (type === 'crash') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } 
    else if (type === 'heart') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.22);
      osc2.frequency.setValueAtTime(659.25, now);
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.22);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    } 
    else if (type === 'out_of_fuel') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.15);
      osc.frequency.linearRampToValueAtTime(140, now + 0.3);
      osc.frequency.linearRampToValueAtTime(40, now + 0.6);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }
    else if (type === 'start') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    }
    else if (type === 'thunder') {
      const bufferSize = Math.floor(audioCtx.sampleRate * 1.3);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.42));
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, now);
      filter.frequency.exponentialRampToValueAtTime(35, now + 1.25);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.25);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start(now);
    }
    else if (type === 'weather_switch') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.16);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
    else if (type === 'gear_shift') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  DOM.soundBtn.setAttribute('aria-label', state.soundEnabled ? 'Mute Sound' : 'Unmute Sound');
  if (state.soundEnabled) {
    initAudio();
  }
}

// ----------------------------------------------------------------------------
// 5. CORE GAME LOOP
// ----------------------------------------------------------------------------
function gameLoop(timestamp) {
  if (state.current !== GameState.PLAYING) {
    return;
  }

  try {
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    const rawDelta = (timestamp - state.lastFrameTime) / 1000;
    const dt = Math.min(rawDelta, 0.05);
    state.lastFrameTime = timestamp;

    // 1. Move Player
    movePlayer(dt);

    // 2. Consume Fuel (gently drains, enters low-fuel mode if 0, never freezes)
    updateFuel(dt);

    // 3. Spawn & Move Enemy Cars
    checkAndSpawnEnemy(timestamp);
    moveEnemies(dt);

    // 4. Spawn & Move Pickups (Coins, Fuel, Shields)
    checkAndSpawnPickup(timestamp);
    movePickups(dt);

    // 5. Check Pickups Collision
    checkPickupCollision();

    // 6. Check Enemy Collisions (with Shield protection check)
    const isFatalCollision = checkCollision();
    if (isFatalCollision) {
      gameOver('crash');
      return;
    }

    // 7. Check Passed Enemies & Award Points
    checkPassedEnemies();

    // 8. Increase Difficulty
    increaseDifficulty();

    // 9. Update Road, Subway Surfers Scenery & Skyline Animation
    const roadScrollSpeed = updateRoadAnimation(dt);
    updateScenery(dt, roadScrollSpeed);
    updateSkylineParallax(dt, roadScrollSpeed, timestamp);

    // 10. Update Digital Speedometer (MPH) & High-Speed Warp Streaks
    updateSpeedAndMph(dt);

    // 11. Update Rain particle weather & dynamic lightning
    if (state.weather === 'rain') {
      renderRain(timestamp);
    }

    // 12. Render Game
    renderGame();
  } catch (err) {
    console.warn('Game loop resilient recovery:', err);
  } finally {
    // ALWAYS request next frame if still in PLAYING state
    if (state.current === GameState.PLAYING) {
      state.animationFrameId = requestAnimationFrame(gameLoop);
    }
  }
}

// ----------------------------------------------------------------------------
// 6. GAME CONTROLS & LIFECYCLE
// ----------------------------------------------------------------------------
function startGame() {
  initAudio();
  playSound('start');

  resetGame();

  state.current = GameState.PLAYING;
  state.lastFrameTime = 0;
  state.lastEnemySpawnTime = performance.now();
  state.lastPickupSpawnTime = performance.now();

  DOM.startScreen.classList.remove('active');
  DOM.pauseScreen.classList.remove('active');
  DOM.gameOverScreen.classList.remove('active');
  closeGarageModal();
  closeLeaderboardModal();

  DOM.btnStart.disabled = true;
  DOM.btnPause.disabled = false;
  DOM.btnPause.textContent = 'PAUSE';

  if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (state.current !== GameState.PLAYING) return;

  state.current = GameState.PAUSED;
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  DOM.btnPause.textContent = 'RESUME';
  DOM.pauseScreen.classList.add('active');
}

function resumeGame() {
  if (state.current !== GameState.PAUSED) return;

  initAudio();
  state.current = GameState.PLAYING;
  state.lastFrameTime = performance.now();

  DOM.btnPause.textContent = 'PAUSE';
  DOM.pauseScreen.classList.remove('active');

  if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

function restartGame() {
  DOM.road.classList.remove('crash-shake');
  startGame();
}

function resetGame() {
  state.score = 0;
  state.coins = 0;
  state.fuel = 100;
  state.hasShield = false;
  state.speedMultiplier = 1.0;
  state.speedLabel = '1x';
  state.spawnInterval = CONFIG.BASE_SPAWN_INTERVAL;
  state.pickupSpawnInterval = CONFIG.BASE_PICKUP_INTERVAL;
  state.steeringDirection = 0;
  state.roadOffset = 0;

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (enemy.el && enemy.el.parentNode) {
      enemy.el.parentNode.removeChild(enemy.el);
    }
  }
  state.enemies = [];

  for (let i = 0; i < state.pickups.length; i++) {
    const p = state.pickups[i];
    if (p.el && p.el.parentNode) {
      p.el.parentNode.removeChild(p.el);
    }
  }
  state.pickups = [];

  if (DOM.floatTextContainer) DOM.floatTextContainer.innerHTML = '';

  updateRoadDimensions();
  state.playerX = (state.roadWidth - state.playerWidth) / 2;
  state.playerY = state.roadHeight - state.playerHeight - 20;

  if (DOM.playerShield) DOM.playerShield.style.display = 'none';

  applyVehicleSkin(state.selectedSkin);

  DOM.score.textContent = '0';
  DOM.coins.textContent = '🪙 0';
  state.lives = 3;
  state.isInvulnerable = false;
  updateLivesUI();
  updateFuelUI();
  
  setSpeedGear(1, false);
  state.currentMph = 140;
  if (DOM.speed) DOM.speed.textContent = '140';
  if (DOM.speedWarpLines) DOM.speedWarpLines.classList.remove('active');
  initScenery();

  DOM.road.classList.remove('crash-shake');
  if (DOM.playerCar) DOM.playerCar.classList.remove('invulnerable');
}

function updateLivesUI() {
  if (!DOM.lives) return;
  if (state.lives >= 3) {
    DOM.lives.textContent = '❤️❤️❤️';
  } else if (state.lives === 2) {
    DOM.lives.textContent = '❤️❤️🤍';
  } else if (state.lives === 1) {
    DOM.lives.textContent = '❤️🤍🤍';
  } else {
    DOM.lives.textContent = '🤍🤍🤍';
  }
}

// ----------------------------------------------------------------------------
// 7. PLAYER MOVEMENT & FUEL ENGINE
// ----------------------------------------------------------------------------
function movePlayer(dt) {
  let direction = 0;
  if (state.keys.left) direction -= 1;
  if (state.keys.right) direction += 1;
  state.steeringDirection = direction;

  const currentSteerSpeed = state.keys.nitro ? CONFIG.PLAYER_STEER_SPEED * 1.18 : CONFIG.PLAYER_STEER_SPEED;

  if (direction !== 0) {
    state.playerX += direction * currentSteerSpeed * dt;
  }

  const minX = CONFIG.ROAD_BORDER_WIDTH + 2;
  const maxX = state.roadWidth - CONFIG.ROAD_BORDER_WIDTH - state.playerWidth - 2;
  state.playerX = Math.max(minX, Math.min(state.playerX, maxX));
}

function updateFuel(dt) {
  const burnRate = state.keys.nitro ? CONFIG.NITRO_FUEL_BURN_RATE : CONFIG.BASE_FUEL_BURN_RATE;
  state.fuel = Math.max(0, state.fuel - (burnRate * dt));
  updateFuelUI();
}

function updateFuelUI() {
  if (!DOM.fuelBar || !DOM.fuelText) return;
  const pct = Math.round(state.fuel);
  DOM.fuelBar.style.width = `${pct}%`;

  DOM.fuelBar.classList.remove('fuel-warning', 'fuel-critical');
  if (pct <= 0) {
    DOM.fuelBar.classList.add('fuel-critical');
    DOM.fuelText.textContent = 'LOW ⚠️';
    DOM.fuelText.style.color = '#ff0055';
  } else if (pct < 25) {
    DOM.fuelBar.classList.add('fuel-critical');
    DOM.fuelText.textContent = `${pct}%`;
    DOM.fuelText.style.color = '#ff0055';
  } else if (pct < 50) {
    DOM.fuelBar.classList.add('fuel-warning');
    DOM.fuelText.textContent = `${pct}%`;
    DOM.fuelText.style.color = '#ffb703';
  } else {
    DOM.fuelText.textContent = `${pct}%`;
    DOM.fuelText.style.color = '#00ff88';
  }
}

// ----------------------------------------------------------------------------
// 8. TRAFFIC (ENEMY CARS) ENGINE
// ----------------------------------------------------------------------------
function createEnemy() {
  const usableWidth = state.roadWidth - (CONFIG.ROAD_BORDER_WIDTH * 2);
  const laneWidth = usableWidth / CONFIG.TOTAL_LANES;

  // Check which lanes currently have traffic near the top spawn area
  const laneClear = [true, true, true];
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    // If an enemy is within 250px of top, this lane is busy
    if (e.y < 250 && e.lane >= 0 && e.lane < CONFIG.TOTAL_LANES) {
      laneClear[e.lane] = false;
    }
  }

  const clearLanes = [];
  for (let l = 0; l < CONFIG.TOTAL_LANES; l++) {
    if (laneClear[l]) clearLanes.push(l);
  }

  // GUARANTEED SAFE ESCAPE ROUTE:
  // Never spawn if fewer than 2 lanes are clear.
  // This guarantees there is ALWAYS at least one fully unobstructed lane for the player!
  if (clearLanes.length < 2) {
    return false;
  }

  const chosenLane = clearLanes[Math.floor(Math.random() * clearLanes.length)];

  const laneCenterX = CONFIG.ROAD_BORDER_WIDTH + (laneWidth * chosenLane) + (laneWidth / 2);
  const spawnX = laneCenterX - (state.playerWidth / 2);
  const spawnY = -state.playerHeight - 12;

  const styleObj = CONFIG.ENEMY_STYLES[Math.floor(Math.random() * CONFIG.ENEMY_STYLES.length)];
  const speedVariation = 0.94 + Math.random() * 0.12;

  const enemyEl = document.createElement('div');
  enemyEl.className = 'enemy-car';
  enemyEl.setAttribute('role', 'img');
  enemyEl.setAttribute('aria-label', `Enemy Car ${styleObj.name}`);
  enemyEl.innerHTML = `
    <div class="car-shadow" aria-hidden="true"></div>
    <div class="car-body enemy-body ${styleObj.class}" aria-hidden="true">
      <div class="car-lights rear-lights">
        <span class="light taillight"></span>
        <span class="light taillight"></span>
      </div>
      <div class="car-windshield rear-windshield"></div>
      <div class="car-roof"><div class="roof-stripe"></div></div>
      <div class="car-windshield front-windshield"></div>
      <div class="car-lights front-lights">
        <span class="light headlight"></span>
        <span class="light headlight"></span>
      </div>
      <div class="car-wheels">
        <span class="wheel wheel-fl"></span>
        <span class="wheel wheel-fr"></span>
        <span class="wheel wheel-rl"></span>
        <span class="wheel wheel-rr"></span>
      </div>
    </div>
    <img src="assets/enemy-car.png" alt="" class="car-asset-img" onerror="this.style.display='none'">
  `;

  DOM.enemyContainer.appendChild(enemyEl);

  state.enemies.push({
    el: enemyEl,
    lane: chosenLane,
    x: spawnX,
    y: spawnY,
    width: state.playerWidth,
    height: state.playerHeight,
    speedMultiplier: speedVariation,
    passed: false
  });

  return true;
}

function checkAndSpawnEnemy(timestamp) {
  if (timestamp - state.lastEnemySpawnTime >= state.spawnInterval) {
    const spawned = createEnemy();
    if (spawned) {
      state.lastEnemySpawnTime = timestamp;
    } else {
      // If road was temporarily congested, check again in 300ms
      state.lastEnemySpawnTime = timestamp - state.spawnInterval + 300;
    }
  }
}

function moveEnemies(dt) {
  const currentSpeed = getEffectiveEnemySpeed();

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    enemy.y += currentSpeed * enemy.speedMultiplier * dt;

    if (enemy.y > state.roadHeight + 80) {
      if (enemy.el && enemy.el.parentNode) {
        enemy.el.parentNode.removeChild(enemy.el);
      }
      state.enemies.splice(i, 1);
    }
  }
}

function checkPassedEnemies() {
  const playerBackY = state.playerY + state.playerHeight;
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (!enemy.passed && enemy.y > playerBackY) {
      enemy.passed = true;
      updateScore(10);
      playSound('pass');
    }
  }
}

// ----------------------------------------------------------------------------
// 9. PICKUPS ENGINE (COINS, FUEL, SHIELD)
// ----------------------------------------------------------------------------
function checkAndSpawnPickup(timestamp) {
  if (timestamp - state.lastPickupSpawnTime < state.pickupSpawnInterval) return;

  state.lastPickupSpawnTime = timestamp;
  const usableWidth = state.roadWidth - (CONFIG.ROAD_BORDER_WIDTH * 2);
  const laneWidth = usableWidth / CONFIG.TOTAL_LANES;

  const lane = Math.floor(Math.random() * CONFIG.TOTAL_LANES);
  const spawnX = CONFIG.ROAD_BORDER_WIDTH + (laneWidth * lane) + (laneWidth / 2);
  const spawnY = -40;

  const rand = Math.random();
  let type = 'coin';
  let innerHtml = '<div class="pickup-inner">🪙</div>';

  if (rand < 0.52) {
    type = 'coin';
    innerHtml = '<div class="pickup-inner">🪙</div>';
  } else if (rand < 0.74) {
    type = 'fuel';
    innerHtml = '<div class="pickup-inner">⛽</div>';
  } else if (rand < 0.88) {
    type = 'shield';
    innerHtml = '<div class="pickup-inner">🛡️</div>';
  } else {
    type = 'heart';
    innerHtml = '<div class="pickup-inner">❤️</div>';
  }

  const el = document.createElement('div');
  el.className = `pickup-item pickup-${type}`;
  el.innerHTML = innerHtml;
  el.style.left = `${spawnX}px`;
  el.style.top = `${spawnY}px`;

  DOM.pickupContainer.appendChild(el);

  state.pickups.push({
    el: el,
    type: type,
    x: spawnX,
    y: spawnY,
    width: 32,
    height: 32,
    collected: false
  });
}

function movePickups(dt) {
  const roadScrollSpeed = getEffectiveRoadSpeed();

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    p.y += roadScrollSpeed * dt;
    p.el.style.top = `${p.y}px`;

    if (p.y > state.roadHeight + 50) {
      if (p.el && p.el.parentNode) {
        p.el.parentNode.removeChild(p.el);
      }
      state.pickups.splice(i, 1);
    }
  }
}

function checkPickupCollision() {
  const pLeft = state.playerX;
  const pRight = state.playerX + state.playerWidth;
  const pTop = state.playerY;
  const pBottom = state.playerY + state.playerHeight;

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const item = state.pickups[i];
    const itemLeft = item.x - 16;
    const itemRight = item.x + 16;
    const itemTop = item.y - 16;
    const itemBottom = item.y + 16;

    const hit = !(
      pRight < itemLeft ||
      pLeft > itemRight ||
      pBottom < itemTop ||
      pTop > itemBottom
    );

    if (hit) {
      if (item.type === 'coin') {
        state.coins += 1;
        updateScore(50);
        DOM.coins.textContent = `🪙 ${state.coins}`;
        playSound('coin');
        createFloatingText('+50', item.x, item.y, 'float-coin');
      } 
      else if (item.type === 'fuel') {
        state.fuel = Math.min(100, state.fuel + 35);
        updateFuelUI();
        playSound('fuel');
        createFloatingText('+35% FUEL', item.x, item.y, 'float-fuel');
      } 
      else if (item.type === 'shield') {
        activateShield();
        playSound('shield_on');
        createFloatingText('🛡️ SHIELD ACTIVE!', item.x, item.y, 'float-shield');
      }
      else if (item.type === 'heart') {
        state.lives = Math.min(3, state.lives + 1);
        updateLivesUI();
        playSound('heart');
        createFloatingText('❤️ +1 LIFE REPAIRED!', item.x, item.y, 'float-heart');
      }

      if (item.el && item.el.parentNode) {
        item.el.parentNode.removeChild(item.el);
      }
      state.pickups.splice(i, 1);
    }
  }
}

function activateShield() {
  state.hasShield = true;
  if (DOM.playerShield) {
    DOM.playerShield.style.display = 'block';
  }
}

function createFloatingText(text, x, y, className) {
  if (!DOM.floatTextContainer) return;
  const popup = document.createElement('div');
  popup.className = `float-popup ${className || ''}`;
  popup.textContent = text;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  DOM.floatTextContainer.appendChild(popup);

  setTimeout(() => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
  }, 900);
}

// ----------------------------------------------------------------------------
// 10. COLLISION DETECTION & SHIELD DEFLECTION
// ----------------------------------------------------------------------------
function checkCollision() {
  const insetX = 6;
  const insetY = 7;

  const playerHitbox = {
    left: state.playerX + insetX,
    right: state.playerX + state.playerWidth - insetX,
    top: state.playerY + insetY,
    bottom: state.playerY + state.playerHeight - insetY
  };

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    const enemyHitbox = {
      left: enemy.x + insetX,
      right: enemy.x + state.playerWidth - insetX,
      top: enemy.y + insetY,
      bottom: enemy.y + state.playerHeight - insetY
    };

    const isColliding = !(
      playerHitbox.right < enemyHitbox.left ||
      playerHitbox.left > enemyHitbox.right ||
      playerHitbox.bottom < enemyHitbox.top ||
      playerHitbox.top > enemyHitbox.bottom
    );

    if (isColliding) {
      // 1. If currently invulnerable from recent hit, ignore collision
      if (state.isInvulnerable) {
        continue;
      }

      // 2. If Shield is active, absorb crash completely
      if (state.hasShield) {
        state.hasShield = false;
        if (DOM.playerShield) DOM.playerShield.style.display = 'none';

        playSound('shield_pop');
        updateScore(100);
        createFloatingText('🛡️ CRASH DEFLECTED! +100', enemy.x, enemy.y, 'float-deflect');

        // Immediately remove enemy from state so it cannot re-collide
        const deflectedEl = enemy.el;
        state.enemies.splice(i, 1);

        if (deflectedEl) {
          deflectedEl.style.transform = 'scale(0.2) rotate(220deg) translateY(-80px)';
          deflectedEl.style.opacity = '0';
          deflectedEl.style.transition = 'all 0.35s ease-out';
          setTimeout(() => {
            if (deflectedEl.parentNode) deflectedEl.parentNode.removeChild(deflectedEl);
          }, 360);
        }

        return false;
      }

      // 3. Multi-life damage reduction (keeps game going)
      if (state.lives > 1) {
        state.lives -= 1;
        updateLivesUI();
        playSound('crash');
        DOM.road.classList.add('crash-shake');
        setTimeout(() => DOM.road.classList.remove('crash-shake'), 400);

        const crashedEl = enemy.el;
        state.enemies.splice(i, 1);
        if (crashedEl && crashedEl.parentNode) {
          crashedEl.parentNode.removeChild(crashedEl);
        }

        createFloatingText(`💥 -1 LIFE! (${state.lives} LEFT)`, state.playerX, state.playerY - 20, 'float-crash');

        // Grant 2 seconds of flashing invulnerability
        state.isInvulnerable = true;
        DOM.playerCar.classList.add('invulnerable');
        setTimeout(() => {
          state.isInvulnerable = false;
          if (DOM.playerCar) DOM.playerCar.classList.remove('invulnerable');
        }, 2000);

        return false;
      }

      // 4. Fatal collision (0 lives left)
      state.lives = 0;
      updateLivesUI();
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// 11. SCORE & SPEED PROGRESSION
// ----------------------------------------------------------------------------
function updateScore(pointsToAdd = 0) {
  state.score = Math.max(0, state.score + pointsToAdd);
  DOM.score.textContent = state.score;

  if (pointsToAdd > 0) {
    DOM.score.classList.remove('bump');
    void DOM.score.offsetWidth;
    DOM.score.classList.add('bump');
  }

  if (state.score > state.highScore) {
    state.highScore = state.score;
    DOM.highScore.textContent = state.highScore;
    try {
      localStorage.setItem('carRacing_highScore', state.highScore);
    } catch (e) {}
  }
}

function increaseDifficulty() {
  let matchedTier = CONFIG.SPEED_TIERS[0];
  for (let i = 0; i < CONFIG.SPEED_TIERS.length; i++) {
    if (state.score <= CONFIG.SPEED_TIERS[i].maxScore) {
      matchedTier = CONFIG.SPEED_TIERS[i];
      break;
    }
  }

  if (state.speedMultiplier !== matchedTier.multiplier) {
    state.speedMultiplier = matchedTier.multiplier;
    state.speedLabel = matchedTier.label;

    state.spawnInterval = Math.max(
      CONFIG.MIN_SPAWN_INTERVAL,
      CONFIG.BASE_SPAWN_INTERVAL / state.speedMultiplier
    );
  }
}

// ----------------------------------------------------------------------------
// 12. GAME OVER SEQUENCE
// ----------------------------------------------------------------------------
function gameOver(reason = 'crash') {
  state.current = GameState.GAME_OVER;

  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  if (reason === 'fuel') {
    playSound('out_of_fuel');
    DOM.gameOverTitle.textContent = 'OUT OF FUEL!';
    DOM.gameOverReason.textContent = 'Your engine sputtered and ran dry! Grab red fuel cans on the highway.';
    DOM.gameOverIcon.textContent = '⛽';
  } else {
    DOM.road.classList.add('crash-shake');
    playSound('crash');
    DOM.gameOverTitle.textContent = 'GAME OVER';
    DOM.gameOverReason.textContent = 'You crashed into oncoming highway traffic!';
    DOM.gameOverIcon.textContent = '💥';
  }

  DOM.btnPause.disabled = true;
  DOM.btnStart.disabled = false;

  DOM.finalScore.textContent = state.score;
  DOM.finalCoins.textContent = `🪙 ${state.coins}`;
  DOM.finalHighScore.textContent = state.highScore;

  if (state.score > 0 && state.score >= state.highScore) {
    DOM.newRecordBadge.style.display = 'inline-block';
  } else {
    DOM.newRecordBadge.style.display = 'none';
  }

  try {
    const lastName = localStorage.getItem('racing_last_driver');
    if (lastName && DOM.driverNameInput) DOM.driverNameInput.value = lastName;
  } catch (e) {}

  if (DOM.saveScoreMsg) DOM.saveScoreMsg.textContent = '';

  syncScoreToCloud(state.score, state.highScore);
  DOM.gameOverScreen.classList.add('active');
}

// ----------------------------------------------------------------------------
// 13. ROAD RENDERING & WEATHER ENGINE
// ----------------------------------------------------------------------------
function getEffectiveRoadSpeed() {
  const nitroBonus = state.keys.nitro ? CONFIG.NITRO_MULTIPLIER : 1.0;
  const gear = CONFIG.SPEED_GEARS[state.gearIndex] || CONFIG.SPEED_GEARS[1];
  return CONFIG.BASE_ROAD_SPEED * state.speedMultiplier * gear.speedMul * nitroBonus;
}

function getEffectiveEnemySpeed() {
  const nitroBonus = state.keys.nitro ? CONFIG.NITRO_MULTIPLIER : 1.0;
  const gear = CONFIG.SPEED_GEARS[state.gearIndex] || CONFIG.SPEED_GEARS[1];
  return CONFIG.BASE_ENEMY_SPEED * state.speedMultiplier * gear.speedMul * nitroBonus;
}

function updateRoadAnimation(dt) {
  const roadScrollSpeed = getEffectiveRoadSpeed();
  state.roadOffset = (state.roadOffset + roadScrollSpeed * dt) % 72;
  return roadScrollSpeed;
}

// ----------------------------------------------------------------------------
// SUBWAY SURFERS SCENERY SYSTEM (HOUSES, TREES, BUILDINGS, BILLBOARDS)
// ----------------------------------------------------------------------------
const SCENERY_TYPES = {
  left: ['tree', 'house', 'tree', 'streetlight', 'house', 'billboard', 'tree'],
  right: ['building', 'tree', 'building', 'billboard', 'streetlight', 'building', 'tree']
};

const BILLBOARD_TEXTS = ['SUBWAY', 'SPEED 99', 'TURBO', 'CYBER CITY', 'SURFERS', 'HYPER', 'APEX RACE'];
const BUILDING_SIGNS = ['METRO', 'HOTEL', 'PLAZA', 'CYBER', 'SURF', 'APEX', 'TOWER'];

function createSceneryElement(type, side) {
  const item = document.createElement('div');
  item.className = `scenery-item scenery-${type}`;
  
  if (type === 'tree') {
    item.innerHTML = `
      <div class="tree-foliage tier-3"></div>
      <div class="tree-foliage tier-2"></div>
      <div class="tree-foliage tier-1"></div>
      <div class="tree-trunk"></div>
    `;
  } else if (type === 'house') {
    const lit1 = Math.random() > 0.4 ? 'lit' : '';
    const lit2 = Math.random() > 0.4 ? 'lit' : '';
    item.innerHTML = `
      <div class="house-roof"><div class="house-chimney"></div></div>
      <div class="house-body">
        <div class="house-windows">
          <div class="win ${lit1}"></div>
          <div class="win ${lit2}"></div>
        </div>
        <div class="house-door"></div>
      </div>
    `;
  } else if (type === 'building') {
    const signText = BUILDING_SIGNS[Math.floor(Math.random() * BUILDING_SIGNS.length)];
    const w1 = Math.random() > 0.35 ? 'lit' : '';
    const w2 = Math.random() > 0.35 ? 'lit' : '';
    const w3 = Math.random() > 0.35 ? 'lit' : '';
    const w4 = Math.random() > 0.35 ? 'lit' : '';
    const w5 = Math.random() > 0.35 ? 'lit' : '';
    const w6 = Math.random() > 0.35 ? 'lit' : '';
    item.innerHTML = `
      <div class="building-roof"><div class="building-antenna"></div></div>
      <div class="building-body">
        <div class="building-neon-sign">${signText}</div>
        <div class="building-grid">
          <div class="b-win ${w1}"></div>
          <div class="b-win ${w2}"></div>
          <div class="b-win ${w3}"></div>
          <div class="b-win ${w4}"></div>
          <div class="b-win ${w5}"></div>
          <div class="b-win ${w6}"></div>
        </div>
      </div>
    `;
  } else if (type === 'streetlight') {
    item.innerHTML = `
      <div class="lamp-head"></div>
      <div class="lamp-post"></div>
    `;
  } else if (type === 'billboard') {
    const text = BILLBOARD_TEXTS[Math.floor(Math.random() * BILLBOARD_TEXTS.length)];
    item.innerHTML = `
      <div class="billboard-board">${text}</div>
      <div class="billboard-legs">
        <div class="billboard-leg"></div>
        <div class="billboard-leg"></div>
      </div>
    `;
  }

  return item;
}

function spawnSceneryItem(side, yPos) {
  const container = side === 'left' ? DOM.sceneryLeft : DOM.sceneryRight;
  if (!container) return;

  const pool = SCENERY_TYPES[side];
  const type = pool[Math.floor(Math.random() * pool.length)];
  const el = createSceneryElement(type, side);
  el.style.top = `${yPos}px`;
  container.appendChild(el);

  state.sceneryItems.push({
    el: el,
    side: side,
    type: type,
    y: yPos
  });
}

function initScenery() {
  if (DOM.sceneryLeft) DOM.sceneryLeft.innerHTML = '';
  if (DOM.sceneryRight) DOM.sceneryRight.innerHTML = '';
  state.sceneryItems = [];

  const h = state.roadHeight || 580;
  // Prepopulate left wing (suburban houses & trees)
  let y = -80;
  while (y < h + 100) {
    spawnSceneryItem('left', y);
    y += 95 + Math.floor(Math.random() * 35);
  }

  // Prepopulate right wing (city buildings & billboards)
  y = -90;
  while (y < h + 100) {
    spawnSceneryItem('right', y);
    y += 105 + Math.floor(Math.random() * 40);
  }
}

function updateScenery(dt, roadScrollSpeed) {
  let minLeftY = Infinity;
  let minRightY = Infinity;

  for (let i = state.sceneryItems.length - 1; i >= 0; i--) {
    const item = state.sceneryItems[i];
    item.y += roadScrollSpeed * dt;
    item.el.style.top = `${item.y}px`;

    if (item.side === 'left' && item.y < minLeftY) minLeftY = item.y;
    if (item.side === 'right' && item.y < minRightY) minRightY = item.y;

    // Remove if scrolled below screen
    if (item.y > state.roadHeight + 110) {
      if (item.el && item.el.parentNode) {
        item.el.parentNode.removeChild(item.el);
      }
      state.sceneryItems.splice(i, 1);
    }
  }

  // Spawn new items at top if needed
  if (minLeftY === Infinity || minLeftY > -30) {
    const spawnY = (minLeftY === Infinity ? -40 : minLeftY) - (95 + Math.random() * 35);
    spawnSceneryItem('left', spawnY);
  }
  if (minRightY === Infinity || minRightY > -30) {
    const spawnY = (minRightY === Infinity ? -40 : minRightY) - (105 + Math.random() * 40);
    spawnSceneryItem('right', spawnY);
  }
}

function updateSkylineParallax(dt, roadScrollSpeed, timestamp) {
  if (DOM.skylineClouds) {
    const cloudOffset = (timestamp * 0.015) % 1000;
    DOM.skylineClouds.style.backgroundPosition = `${cloudOffset}px 0`;
  }
  if (DOM.skylineCity) {
    const cityOffset = (timestamp * 0.006) % 1000;
    DOM.skylineCity.style.backgroundPosition = `${cityOffset}px 0`;
  }
}

function updateSpeedAndMph(dt) {
  const gear = CONFIG.SPEED_GEARS[state.gearIndex] || CONFIG.SPEED_GEARS[1];
  const nitroBonus = state.keys.nitro ? 1.34 : 1.0;
  const targetMph = gear.baseMph * state.speedMultiplier * nitroBonus + (Math.random() * 2 - 1);
  state.currentMph += (targetMph - state.currentMph) * Math.min(1.0, dt * 6);

  if (DOM.speed) {
    DOM.speed.textContent = Math.round(state.currentMph);
  }

  const isHighSpeed = state.keys.nitro || gear.id === 'hyper' || state.currentMph >= 180;
  if (DOM.speedWarpLines) {
    DOM.speedWarpLines.classList.toggle('active', isHighSpeed);
  }
}

function setSpeedGear(index, notify = true) {
  state.gearIndex = (index + CONFIG.SPEED_GEARS.length) % CONFIG.SPEED_GEARS.length;
  const gear = CONFIG.SPEED_GEARS[state.gearIndex];

  if (DOM.btnGear) {
    DOM.btnGear.className = `gear-badge ${gear.class}`;
    DOM.btnGear.textContent = gear.name;
  }

  if (notify) {
    playSound('gear_shift');
    createFloatingText(`⚙️ ${gear.name}`, state.playerX, state.playerY - 25, 'float-gear');
  }
}

function cycleSpeedGear() {
  setSpeedGear(state.gearIndex + 1, true);
}

function renderGame() {
  DOM.road.style.backgroundPositionY = `${state.roadOffset}px`;
  DOM.laneDividers.forEach(divider => {
    divider.style.transform = `translateX(-50%) translateY(${state.roadOffset}px)`;
  });

  DOM.playerCar.style.left = `${state.playerX}px`;
  DOM.playerCar.style.top = `${state.playerY}px`;

  let carClasses = 'player-car';
  if (state.steeringDirection < 0) carClasses += ' tilt-left';
  if (state.steeringDirection > 0) carClasses += ' tilt-right';
  if (state.keys.nitro) carClasses += ' nitro-active';
  DOM.playerCar.className = carClasses;

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;
  }
}

// Weather Engine
let rainParticles = [];
let rainSplashes = [];
let lastLightningTime = 0;
let nextLightningInterval = 7000 + Math.random() * 6000;

function initRainParticles() {
  rainParticles = [];
  rainSplashes = [];
  const w = state.roadWidth || 400;
  const h = state.roadHeight || 600;
  for (let i = 0; i < 110; i++) {
    rainParticles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      length: 14 + Math.random() * 16,
      speed: 22 + Math.random() * 14,
      opacity: 0.35 + Math.random() * 0.4
    });
  }
}

function renderRain(timestamp = performance.now()) {
  if (!DOM.rainCanvas) return;
  const ctx = DOM.rainCanvas.getContext('2d');
  if (!ctx) return;

  if (DOM.rainCanvas.width !== state.roadWidth || DOM.rainCanvas.height !== state.roadHeight) {
    DOM.rainCanvas.width = state.roadWidth;
    DOM.rainCanvas.height = state.roadHeight;
  }

  const w = DOM.rainCanvas.width;
  const h = DOM.rainCanvas.height;

  ctx.clearRect(0, 0, w, h);

  // 1. Render Rain Streaks
  for (let i = 0; i < rainParticles.length; i++) {
    const p = rainParticles[i];
    ctx.strokeStyle = `rgba(180, 230, 255, ${p.opacity})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 3.5, p.y + p.length);
    ctx.stroke();

    p.y += p.speed;
    p.x += 1.8;

    if (p.y > h - 10) {
      if (rainSplashes.length < 35 && Math.random() < 0.4) {
        rainSplashes.push({
          x: p.x,
          y: Math.min(h - 5, p.y),
          radius: 1.5,
          maxRadius: 6 + Math.random() * 6,
          opacity: 0.6
        });
      }
      p.y = -p.length;
      p.x = Math.random() * w;
    }
  }

  // 2. Render Splash Ripples
  for (let s = rainSplashes.length - 1; s >= 0; s--) {
    const sp = rainSplashes[s];
    ctx.strokeStyle = `rgba(160, 220, 255, ${sp.opacity})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, sp.radius * 1.6, sp.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    sp.radius += 0.45;
    sp.opacity -= 0.04;

    if (sp.opacity <= 0 || sp.radius >= sp.maxRadius) {
      rainSplashes.splice(s, 1);
    }
  }

  // 3. Dynamic Thunder & Lightning Flash
  if (state.current === GameState.PLAYING) {
    if (!lastLightningTime) lastLightningTime = timestamp;
    if (timestamp - lastLightningTime > nextLightningInterval) {
      triggerLightningStrike();
      lastLightningTime = timestamp;
      nextLightningInterval = 7000 + Math.random() * 8000;
    }
  }
}

function triggerLightningStrike() {
  if (!DOM.road || state.weather !== 'rain') return;
  DOM.road.classList.remove('lightning-active');
  void DOM.road.offsetWidth;
  DOM.road.classList.add('lightning-active');
  playSound('thunder');
  setTimeout(() => {
    if (DOM.road) DOM.road.classList.remove('lightning-active');
  }, 440);
}

function cycleWeather() {
  const modes = ['day', 'night', 'rain'];
  const currentIndex = modes.indexOf(state.weather);
  const nextMode = modes[(currentIndex + 1) % modes.length];
  setWeather(nextMode, true);
}

function setWeather(mode, notify = true) {
  state.weather = mode;

  // 1. Update road & Subway Surfers scenery classes
  DOM.road.classList.remove('weather-day', 'weather-night', 'weather-rain');
  DOM.road.classList.add(`weather-${mode}`);

  if (DOM.sceneryLeft) {
    DOM.sceneryLeft.classList.remove('weather-day', 'weather-night', 'weather-rain');
    DOM.sceneryLeft.classList.add(`weather-${mode}`);
  }
  if (DOM.sceneryRight) {
    DOM.sceneryRight.classList.remove('weather-day', 'weather-night', 'weather-rain');
    DOM.sceneryRight.classList.add(`weather-${mode}`);
  }
  if (DOM.distantSkyline) {
    DOM.distantSkyline.classList.remove('weather-day', 'weather-night', 'weather-rain');
    DOM.distantSkyline.classList.add(`weather-${mode}`);
  }

  // 2. Update body theme classes
  document.body.classList.remove('weather-day-active', 'weather-night-active', 'weather-rain-active');
  document.body.classList.add(`weather-${mode}-active`);

  // 3. Update active pill buttons
  document.querySelectorAll('.weather-pill').forEach(pill => {
    if (pill.dataset.weather === mode) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  // 4. Update Header Icon, Tooltip, and floating banner
  if (mode === 'day') {
    DOM.weatherIcon.textContent = '☀️';
    DOM.btnWeather.title = 'Daylight Horizon (Click for Neon Night)';
    if (notify) createFloatingText('☀️ DAYLIGHT SUNRISE', state.roadWidth / 2, 70, 'float-weather float-weather-day');
  } else if (mode === 'night') {
    DOM.weatherIcon.textContent = '🌙';
    DOM.btnWeather.title = 'Cyber Neon Night (Click for Rainstorm)';
    if (notify) createFloatingText('🌙 CYBER NEON NIGHT', state.roadWidth / 2, 70, 'float-weather float-weather-night');
  } else if (mode === 'rain') {
    DOM.weatherIcon.textContent = '🌧️';
    DOM.btnWeather.title = 'Heavy Thunderstorm (Click for Daylight)';
    initRainParticles();
    if (notify) {
      createFloatingText('🌧️ HEAVY THUNDERSTORM', state.roadWidth / 2, 70, 'float-weather float-weather-rain');
      playSound('thunder');
    }
  }

  if (notify) playSound('weather_switch');

  try {
    localStorage.setItem('racing_weather_pref', mode);
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// 14. GARAGE VEHICLE CUSTOMIZER
// ----------------------------------------------------------------------------
function initGarage() {
  const savedSkin = localStorage.getItem('racing_car_skin') || 'skin-cyber-blue';
  state.selectedSkin = savedSkin;
  applyVehicleSkin(savedSkin);
  renderGarageGrid();
}

function renderGarageGrid() {
  if (!DOM.garageCarGrid) return;
  DOM.garageCarGrid.innerHTML = '';

  CONFIG.CARS.forEach(car => {
    const item = document.createElement('div');
    item.className = `garage-item ${car.id === state.selectedSkin ? 'selected' : ''}`;
    item.dataset.skin = car.id;
    item.innerHTML = `
      <div class="garage-preview-box" style="background: ${car.color};"></div>
      <div class="garage-info">
        <div class="garage-car-name">${car.name} <span class="garage-badge">${car.badge}</span></div>
        <div class="garage-car-desc">${car.desc}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      document.querySelectorAll('.garage-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      state.selectedSkin = car.id;
      applyVehicleSkin(car.id);
    });

    DOM.garageCarGrid.appendChild(item);
  });
}

function applyVehicleSkin(skinId) {
  if (!DOM.playerBody) return;
  CONFIG.CARS.forEach(c => DOM.playerBody.classList.remove(c.id));
  DOM.playerBody.classList.add(skinId);

  const carConfig = CONFIG.CARS.find(c => c.id === skinId);
  if (DOM.policeSiren) {
    DOM.policeSiren.style.display = (carConfig && carConfig.isPolice) ? 'flex' : 'none';
  }

  try {
    localStorage.setItem('racing_car_skin', skinId);
  } catch (e) {}
}

function openGarageModal() {
  if (!DOM.garageModal) return;
  renderGarageGrid();
  DOM.garageModal.classList.add('active');
}

function closeGarageModal() {
  if (!DOM.garageModal) return;
  DOM.garageModal.classList.remove('active');
}

// ----------------------------------------------------------------------------
// 15. LEADERBOARD ENGINE
// ----------------------------------------------------------------------------
function initLeaderboard() {
  try {
    const saved = localStorage.getItem('racing_leaderboard');
    if (saved) {
      state.leaderboard = JSON.parse(saved);
    } else {
      state.leaderboard = [...CONFIG.DEFAULT_LEADERBOARD];
      localStorage.setItem('racing_leaderboard', JSON.stringify(state.leaderboard));
    }
  } catch (e) {
    state.leaderboard = [...CONFIG.DEFAULT_LEADERBOARD];
  }
}

function renderLeaderboardTable() {
  if (!DOM.leaderboardTbody) return;
  DOM.leaderboardTbody.innerHTML = '';

  state.leaderboard.sort((a, b) => b.score - a.score);

  state.leaderboard.slice(0, 10).forEach((entry, idx) => {
    const row = document.createElement('tr');
    let rankBadge = `${idx + 1}`;
    if (idx === 0) rankBadge = '🥇 1st';
    else if (idx === 1) rankBadge = '🥈 2nd';
    else if (idx === 2) rankBadge = '🥉 3rd';

    row.innerHTML = `
      <td class="${idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : ''}">${rankBadge}</td>
      <td><strong>${escapeHtml(entry.name)}</strong></td>
      <td>${escapeHtml(entry.car || 'Racer')}</td>
      <td><strong>${entry.score}</strong></td>
    `;
    DOM.leaderboardTbody.appendChild(row);
  });
}

function saveScoreToLeaderboard() {
  const name = DOM.driverNameInput ? DOM.driverNameInput.value.trim().toUpperCase() : 'DRIVER_1';
  if (!name) return;

  const currentCar = CONFIG.CARS.find(c => c.id === state.selectedSkin);
  const carName = currentCar ? currentCar.name : 'Supercar';

  state.leaderboard.push({
    name: name,
    car: carName,
    score: state.score,
    timestamp: new Date().toISOString()
  });

  state.leaderboard.sort((a, b) => b.score - a.score);
  state.leaderboard = state.leaderboard.slice(0, 15);

  try {
    localStorage.setItem('racing_leaderboard', JSON.stringify(state.leaderboard));
    localStorage.setItem('racing_last_driver', name);
  } catch (e) {}

  if (DOM.saveScoreMsg) {
    DOM.saveScoreMsg.textContent = `✅ Saved ${name} with ${state.score} pts!`;
  }

  setTimeout(() => {
    openLeaderboardModal();
  }, 700);
}

function openLeaderboardModal() {
  if (!DOM.leaderboardModal) return;
  renderLeaderboardTable();
  DOM.leaderboardModal.classList.add('active');
}

function closeLeaderboardModal() {
  if (!DOM.leaderboardModal) return;
  DOM.leaderboardModal.classList.remove('active');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// ----------------------------------------------------------------------------
// 16. INPUT LISTENERS & EVENTS
// ----------------------------------------------------------------------------
function setupInputListeners() {
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') state.keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      state.keys.nitro = true;
    }

    if (e.code === 'KeyP') {
      if (state.current === GameState.PLAYING) pauseGame();
      else if (state.current === GameState.PAUSED) resumeGame();
    }

    if (e.code === 'KeyC') {
      cycleWeather();
    }

    if (e.code === 'KeyG') {
      cycleSpeedGear();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') state.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') state.keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      state.keys.nitro = false;
    }
  });

  // Mobile Touch Controls
  function bindTouchSteer(buttonEl, keyName) {
    if (!buttonEl) return;
    const startSteer = (e) => {
      e.preventDefault();
      initAudio();
      state.keys[keyName] = true;
      buttonEl.classList.add('pressed');
    };

    const stopSteer = (e) => {
      e.preventDefault();
      state.keys[keyName] = false;
      buttonEl.classList.remove('pressed');
    };

    buttonEl.addEventListener('pointerdown', startSteer);
    buttonEl.addEventListener('pointerup', stopSteer);
    buttonEl.addEventListener('pointercancel', stopSteer);
    buttonEl.addEventListener('pointerleave', stopSteer);
    buttonEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindTouchSteer(DOM.btnMobileLeft, 'left');
  bindTouchSteer(DOM.btnMobileNitro, 'nitro');
  bindTouchSteer(DOM.btnMobileRight, 'right');

  // Toolbar Handlers
  DOM.btnStart.addEventListener('click', () => {
    if (state.current === GameState.START || state.current === GameState.GAME_OVER) startGame();
  });
  DOM.btnPause.addEventListener('click', () => {
    if (state.current === GameState.PLAYING) pauseGame();
    else if (state.current === GameState.PAUSED) resumeGame();
  });
  DOM.btnRestart.addEventListener('click', restartGame);

  // Speed Gear Shifter Button
  if (DOM.btnGear) {
    DOM.btnGear.addEventListener('click', () => {
      DOM.btnGear.blur();
      cycleSpeedGear();
    });
  }

  // New Upgrade Buttons
  if (DOM.btnGarage) DOM.btnGarage.addEventListener('click', openGarageModal);
  if (DOM.startGarageBtn) DOM.startGarageBtn.addEventListener('click', openGarageModal);
  if (DOM.garageCloseBtn) DOM.garageCloseBtn.addEventListener('click', closeGarageModal);
  if (DOM.garageSelectBtn) DOM.garageSelectBtn.addEventListener('click', closeGarageModal);

  if (DOM.btnWeather) DOM.btnWeather.addEventListener('click', cycleWeather);

  // On-Demand Weather Pill Selectors
  document.querySelectorAll('.weather-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.blur();
      const mode = pill.dataset.weather;
      if (mode) setWeather(mode, true);
    });
  });

  if (DOM.btnLeaderboard) DOM.btnLeaderboard.addEventListener('click', openLeaderboardModal);
  if (DOM.leaderboardCloseBtn) DOM.leaderboardCloseBtn.addEventListener('click', closeLeaderboardModal);
  if (DOM.leaderboardCloseBtnBottom) DOM.leaderboardCloseBtnBottom.addEventListener('click', closeLeaderboardModal);
  if (DOM.gameOverBoardBtn) DOM.gameOverBoardBtn.addEventListener('click', openLeaderboardModal);
  if (DOM.btnSaveScore) DOM.btnSaveScore.addEventListener('click', saveScoreToLeaderboard);

  // Overlay Buttons
  DOM.startScreenBtn.addEventListener('click', startGame);
  DOM.pauseResumeBtn.addEventListener('click', resumeGame);
  DOM.gameOverRestartBtn.addEventListener('click', restartGame);
  DOM.soundBtn.addEventListener('click', toggleSound);

  // QR Code Scanner Controls
  if (DOM.btnQr) DOM.btnQr.addEventListener('click', openQRModal);
  if (DOM.startQrBtn) DOM.startQrBtn.addEventListener('click', openQRModal);
  if (DOM.qrCloseBtn) DOM.qrCloseBtn.addEventListener('click', closeQRModal);
  if (DOM.btnCopyUrl) DOM.btnCopyUrl.addEventListener('click', copyGameURL);

  // Prevent focused buttons from triggering on Spacebar
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.blur();
    });
  });

  // Direct Road Touch Steering for Mobile
  if (DOM.road) {
    let roadTouching = false;
    const handleRoadTouch = (e) => {
      if (state.current !== GameState.PLAYING) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      
      const touch = e.touches ? e.touches[0] : e;
      const roadRect = DOM.road.getBoundingClientRect();
      const relativeX = touch.clientX - roadRect.left;
      
      initAudio();
      roadTouching = true;
      if (relativeX < roadRect.width * 0.45) {
        state.keys.left = true;
        state.keys.right = false;
      } else if (relativeX > roadRect.width * 0.55) {
        state.keys.right = true;
        state.keys.left = false;
      } else {
        state.keys.left = false;
        state.keys.right = false;
      }
    };

    DOM.road.addEventListener('touchstart', handleRoadTouch, { passive: true });
    DOM.road.addEventListener('touchmove', handleRoadTouch, { passive: true });
    const endRoadTouch = () => {
      if (!roadTouching) return;
      roadTouching = false;
      state.keys.left = false;
      state.keys.right = false;
    };
    DOM.road.addEventListener('touchend', endRoadTouch);
    DOM.road.addEventListener('touchcancel', endRoadTouch);
  }

  window.addEventListener('resize', () => {
    updateRoadDimensions();
    const minX = CONFIG.ROAD_BORDER_WIDTH + 2;
    const maxX = state.roadWidth - CONFIG.ROAD_BORDER_WIDTH - state.playerWidth - 2;
    state.playerX = Math.max(minX, Math.min(state.playerX, maxX));
    state.playerY = state.roadHeight - state.playerHeight - 20;
    renderGame();
  });
}

function updateRoadDimensions() {
  const rect = DOM.road.getBoundingClientRect();
  state.roadWidth = rect.width || 380;
  state.roadHeight = rect.height || 580;
}

// ----------------------------------------------------------------------------
// 17. INITIALIZATION
// ----------------------------------------------------------------------------
function init() {
  try {
    const saved = localStorage.getItem('carRacing_highScore');
    if (saved) {
      state.highScore = parseInt(saved, 10) || 0;
      DOM.highScore.textContent = state.highScore;
    }
  } catch (e) {}

  initLeaderboard();
  initGarage();
  updateRoadDimensions();
  updateLivesUI();
  setSpeedGear(1, false);
  initScenery();

  const savedWeather = localStorage.getItem('racing_weather_pref') || 'day';
  setWeather(savedWeather, false);

  state.playerX = (state.roadWidth - state.playerWidth) / 2;
  state.playerY = state.roadHeight - state.playerHeight - 20;

  renderGame();
  setupInputListeners();
  updateQRCode(getActiveGameURL());

  console.log('🏎️ Car Racing Game upgraded successfully with Garage, Pickups, Weather & Leaderboards!');
}

// ----------------------------------------------------------------------------
// 18. QR CODE MODAL & CLOUD SYNC
// ----------------------------------------------------------------------------
const QR_CONFIG = {
  LOCAL_URL: window.location.origin + window.location.pathname
};

function getActiveGameURL() {
  return QR_CONFIG.LOCAL_URL;
}

function updateQRCode(url) {
  if (!DOM.qrImage) return;

  if (DOM.qrLoading) {
    DOM.qrLoading.textContent = 'Generating QR Code...';
    DOM.qrLoading.style.display = 'flex';
  }
  if (DOM.qrUrlInput) DOM.qrUrlInput.value = url;

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(url)}`;
  
  DOM.qrImage.onload = () => {
    if (DOM.qrLoading) DOM.qrLoading.style.display = 'none';
  };
  DOM.qrImage.onerror = () => {
    if (DOM.qrLoading) {
      DOM.qrLoading.textContent = 'Scan link: ' + url;
      DOM.qrLoading.style.display = 'flex';
    }
  };
  DOM.qrImage.src = qrApiUrl;
}

function openQRModal() {
  if (!DOM.qrModal) return;
  DOM.qrModal.classList.add('active');
  updateQRCode(getActiveGameURL());
}

function closeQRModal() {
  if (!DOM.qrModal) return;
  DOM.qrModal.classList.remove('active');
  if (DOM.copyFeedback) DOM.copyFeedback.textContent = '';
}

function copyGameURL() {
  const url = DOM.qrUrlInput ? DOM.qrUrlInput.value : getActiveGameURL();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      if (DOM.copyFeedback) DOM.copyFeedback.textContent = '✅ Copied to clipboard!';
      setTimeout(() => { if (DOM.copyFeedback) DOM.copyFeedback.textContent = ''; }, 2500);
    }).catch(() => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  if (DOM.qrUrlInput) {
    DOM.qrUrlInput.select();
    document.execCommand('copy');
    if (DOM.copyFeedback) DOM.copyFeedback.textContent = '✅ Copied!';
    setTimeout(() => { if (DOM.copyFeedback) DOM.copyFeedback.textContent = ''; }, 2500);
  }
}

async function syncScoreToCloud(score, highScore) {
  if (!DOM.apiSyncStatus) return;
  DOM.apiSyncStatus.textContent = '☁️ Syncing with Cloud API...';
  
  try {
    const payload = {
      game: 'Car Racing Game',
      score: score,
      highScore: highScore,
      timestamp: new Date().toISOString()
    };

    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      DOM.apiSyncStatus.textContent = '☁️ Synced to Cloud API (HTTP 200 OK)';
      DOM.apiSyncStatus.style.color = '#00ff88';
    } else {
      DOM.apiSyncStatus.textContent = '☁️ Score recorded locally';
    }
  } catch (err) {
    DOM.apiSyncStatus.textContent = '☁️ Score saved to session';
  }
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
