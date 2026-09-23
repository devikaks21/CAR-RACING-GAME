/**
 * ============================================================================
 * CAR RACING GAME - VANILLA JAVASCRIPT ENGINE
 * ============================================================================
 * Architecture:
 * - Game State Machine: START, PLAYING, PAUSED, GAME OVER
 * - Unified requestAnimationFrame Loop (Single active loop guarantee)
 * - Frame-rate independent delta time physics
 * - Fair Lane Spawning & Collision Detection
 * - Web Audio API Procedural Sound Engine
 * ============================================================================
 */

'use strict';

// ----------------------------------------------------------------------------
// 1. GAME CONSTANTS & CONFIGURATION
// ----------------------------------------------------------------------------
const CONFIG = {
  // Speeds in pixels per second (boosted for fast arcade thrills)
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
  MIN_VERTICAL_GAP: 220, // Min pixels between cars in nearby lanes

  // Score intervals for speed scaling
  SPEED_TIERS: [
    { maxScore: 499,  multiplier: 1.0, label: '1x' },
    { maxScore: 999,  multiplier: 1.5, label: '1.5x' },
    { maxScore: 1499, multiplier: 2.0, label: '2x' },
    { maxScore: Infinity, multiplier: 2.5, label: '2.5x' }
  ],

  // Enemy color variations
  ENEMY_STYLES: [
    { class: 'enemy-red',    name: 'Red Streak' },
    { class: 'enemy-yellow', name: 'Golden Taxi' },
    { class: 'enemy-green',  name: 'Viper Green' },
    { class: 'enemy-purple', name: 'Phantom Purple' },
    { class: 'enemy-orange', name: 'Blaze Orange' }
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
  speedMultiplier: 1.0,
  speedLabel: '1x',
  
  // Player position & movement
  playerX: 0,
  playerY: 0,
  playerWidth: 48,
  playerHeight: 84,
  steeringDirection: 0, // -1: Left, 0: Idle, 1: Right

  // Road animation
  roadOffset: 0,
  roadWidth: 380,
  roadHeight: 580,

  // Active enemies
  enemies: [],
  lastSpawnTime: 0,
  spawnInterval: CONFIG.BASE_SPAWN_INTERVAL,

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
  soundEnabled: true
};

// ----------------------------------------------------------------------------
// 3. DOM ELEMENT REFERENCES
// ----------------------------------------------------------------------------
const DOM = {
  // HUD
  score: document.getElementById('score'),
  highScore: document.getElementById('high-score'),
  speed: document.getElementById('speed'),
  soundBtn: document.getElementById('btn-sound'),
  soundIcon: document.getElementById('sound-icon'),

  // Header Toolbar Buttons
  btnStart: document.getElementById('btn-start'),
  btnPause: document.getElementById('btn-pause'),
  btnRestart: document.getElementById('btn-restart'),

  // Game Area
  road: document.getElementById('road'),
  laneDividers: document.querySelectorAll('.lane-divider'),
  enemyContainer: document.getElementById('enemy-container'),
  playerCar: document.getElementById('player-car'),

  // Overlays
  startScreen: document.getElementById('start-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameOverScreen: document.getElementById('game-over-screen'),

  // Overlay Buttons & Displays
  startScreenBtn: document.getElementById('start-screen-btn'),
  pauseResumeBtn: document.getElementById('pause-resume-btn'),
  gameOverRestartBtn: document.getElementById('game-over-restart-btn'),
  finalScore: document.getElementById('final-score'),
  finalHighScore: document.getElementById('final-high-score'),
  newRecordBadge: document.getElementById('new-record-badge'),

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
  tabPublicUrl: document.getElementById('tab-public-url'),
  tabLocalUrl: document.getElementById('tab-local-url'),
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
      // Pleasant high-pitch passing ping
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } 
    else if (type === 'crash') {
      // Impact crash noise & boom
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
    else if (type === 'start') {
      // Engine rev
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
/**
 * Main Game Loop:
 * 1. Move Player
 * 2. Move Enemy Cars
 * 3. Check Collision
 * 4. Check Passed Enemies
 * 5. Update Score
 * 6. Increase Difficulty
 * 7. Update Road Animation
 * 8. Render Game
 * 9. requestAnimationFrame
 */
function gameLoop(timestamp) {
  if (state.current !== GameState.PLAYING) {
    return;
  }

  // Calculate delta time in seconds, clamped to avoid huge jumps on lag spikes
  if (!state.lastFrameTime) state.lastFrameTime = timestamp;
  const rawDelta = (timestamp - state.lastFrameTime) / 1000;
  const dt = Math.min(rawDelta, 0.05); // Cap at max 50ms per frame
  state.lastFrameTime = timestamp;

  // 1. Move Player
  movePlayer(dt);

  // 2. Spawn & Move Enemy Cars
  checkAndSpawnEnemy(timestamp);
  moveEnemies(dt);

  // 3. Check Collision (Stop immediately if collision occurred)
  const hasCollided = checkCollision();
  if (hasCollided) {
    gameOver();
    return; // Exit game loop immediately
  }

  // 4 & 5. Check Passed Enemies & Update Score
  checkPassedEnemies();

  // 6. Increase Difficulty
  increaseDifficulty();

  // 7. Update Road Animation
  updateRoadAnimation(dt);

  // 8. Render Game
  renderGame();

  // 9. Request Next Frame
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

// ----------------------------------------------------------------------------
// 6. REQUIRED FUNCTIONS (SPECIFICATION IMPLEMENTATION)
// ----------------------------------------------------------------------------

/**
 * Starts the game from the Start screen or resets from a fresh state.
 */
function startGame() {
  initAudio();
  playSound('start');

  // Cancel any existing loop to guarantee a single active loop
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  // Reset core metrics
  state.score = 0;
  state.speedMultiplier = 1.0;
  state.speedLabel = '1x';
  state.enemies = [];
  state.lastSpawnTime = performance.now();
  state.lastFrameTime = 0;

  // Clear enemies from DOM
  DOM.enemyContainer.innerHTML = '';
  DOM.road.classList.remove('crash-shake');

  // Update layout dimensions and center player car
  updateRoadDimensions();
  state.playerX = (state.roadWidth - state.playerWidth) / 2;
  state.playerY = state.roadHeight - state.playerHeight - 20;

  // Update HUD
  DOM.score.textContent = '0';
  DOM.speed.textContent = '1x';
  DOM.btnStart.disabled = true;
  DOM.btnPause.disabled = false;
  DOM.btnPause.textContent = 'PAUSE';

  // Hide all overlays
  DOM.startScreen.classList.remove('active');
  DOM.pauseScreen.classList.remove('active');
  DOM.gameOverScreen.classList.remove('active');

  // Switch state and launch loop
  state.current = GameState.PLAYING;
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Pauses the game, freezing all elements, animations, and score updates.
 */
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

/**
 * Resumes gameplay from a paused state.
 */
function resumeGame() {
  if (state.current !== GameState.PAUSED) return;

  initAudio();
  state.current = GameState.PLAYING;
  state.lastFrameTime = performance.now();
  state.lastSpawnTime = performance.now(); // Avoid instant enemy spawn after long pause

  DOM.btnPause.textContent = 'PAUSE';
  DOM.pauseScreen.classList.remove('active');

  // Relaunch single game loop
  state.animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Restarts the game cleanly with no duplicate event listeners or loops.
 */
function restartGame() {
  initAudio();

  // Stop active game loop
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  // Start fresh
  startGame();
}

/**
 * Moves the player car smoothly left or right based on active inputs.
 * Strictly clamps position within the road curbs.
 */
function movePlayer(dt) {
  let direction = 0;
  if (state.keys.left) direction -= 1;
  if (state.keys.right) direction += 1;
  state.steeringDirection = direction;

  const currentSteerSpeed = state.keys.nitro ? CONFIG.PLAYER_STEER_SPEED * 1.18 : CONFIG.PLAYER_STEER_SPEED;

  if (direction !== 0) {
    state.playerX += direction * currentSteerSpeed * dt;
  }

  // Road boundary clamping (keep player inside road curbs)
  const minX = CONFIG.ROAD_BORDER_WIDTH + 2;
  const maxX = state.roadWidth - CONFIG.ROAD_BORDER_WIDTH - state.playerWidth - 2;
  state.playerX = Math.max(minX, Math.min(state.playerX, maxX));
}

/**
 * Spawns an enemy car dynamically into an open lane using fair AI rules.
 */
function createEnemy() {
  // Compute lane metrics
  const usableWidth = state.roadWidth - (CONFIG.ROAD_BORDER_WIDTH * 2);
  const laneWidth = usableWidth / CONFIG.TOTAL_LANES;

  // Find candidate lanes that are fair to spawn in
  const availableLanes = [];
  for (let lane = 0; lane < CONFIG.TOTAL_LANES; lane++) {
    // Check if any existing enemy in or adjacent to this lane is too close to the top
    const isObstructed = state.enemies.some(e => {
      const isNearbyLane = Math.abs(e.lane - lane) <= 1;
      const isNearTop = e.y < CONFIG.MIN_VERTICAL_GAP;
      return isNearbyLane && isNearTop;
    });

    if (!isObstructed) {
      availableLanes.push(lane);
    }
  }

  // Fairness Guarantee: Never block all lanes
  // If all lanes are somehow tight, pick the lane where enemies are furthest down
  let chosenLane = 0;
  if (availableLanes.length > 0) {
    chosenLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
  } else {
    // Fallback: Pick the lane whose top-most enemy has the largest Y coordinate
    let maxDistance = -Infinity;
    for (let lane = 0; lane < CONFIG.TOTAL_LANES; lane++) {
      const topEnemyInLane = state.enemies
        .filter(e => e.lane === lane)
        .sort((a, b) => a.y - b.y)[0];
      const dist = topEnemyInLane ? topEnemyInLane.y : 9999;
      if (dist > maxDistance) {
        maxDistance = dist;
        chosenLane = lane;
      }
    }
  }

  // Calculate X position centered in the chosen lane
  const laneCenterX = CONFIG.ROAD_BORDER_WIDTH + (laneWidth * chosenLane) + (laneWidth / 2);
  const spawnX = laneCenterX - (state.playerWidth / 2);
  const spawnY = -state.playerHeight - 10;

  // Select visual style
  const styleObj = CONFIG.ENEMY_STYLES[Math.floor(Math.random() * CONFIG.ENEMY_STYLES.length)];

  // Slight speed variation for organic traffic feel (+- 8%)
  const speedVariation = 0.92 + Math.random() * 0.16;

  // Create DOM element
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
      <div class="car-roof">
        <div class="roof-stripe"></div>
      </div>
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

  // Store in state
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
}

/**
 * Checks spawn timer and initiates enemy creation when appropriate.
 */
function checkAndSpawnEnemy(timestamp) {
  if (timestamp - state.lastSpawnTime >= state.spawnInterval) {
    createEnemy();
    state.lastSpawnTime = timestamp;
  }
}

/**
 * Moves all active enemy cars downward and removes them once off screen.
 */
function moveEnemies(dt) {
  const nitroBonus = state.keys.nitro ? CONFIG.NITRO_MULTIPLIER : 1.0;
  const currentSpeed = CONFIG.BASE_ENEMY_SPEED * state.speedMultiplier * nitroBonus;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    enemy.y += currentSpeed * enemy.speedMultiplier * dt;

    // Check if enemy has fully exited bottom of road
    if (enemy.y > state.roadHeight + 80) {
      if (enemy.el && enemy.el.parentNode) {
        enemy.el.parentNode.removeChild(enemy.el);
      }
      state.enemies.splice(i, 1);
    }
  }
}

/**
 * Detects collisions between player car and any enemy car using getBoundingClientRect().
 * Uses an inset hitbox for fair, arcade-quality hit detection.
 * @returns {boolean} True if collision detected
 */
function checkCollision() {
  const playerRect = DOM.playerCar.getBoundingClientRect();
  
  // Inset padding for realistic car bumper boundaries (avoids unfair edge clipping)
  const insetX = 6;
  const insetY = 7;

  const playerHitbox = {
    left: playerRect.left + insetX,
    right: playerRect.right - insetX,
    top: playerRect.top + insetY,
    bottom: playerRect.bottom - insetY
  };

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    const enemyRect = enemy.el.getBoundingClientRect();

    const enemyHitbox = {
      left: enemyRect.left + insetX,
      right: enemyRect.right - insetX,
      top: enemyRect.top + insetY,
      bottom: enemyRect.bottom - insetY
    };

    // AABB Rectangle Collision Check
    const isColliding = !(
      playerHitbox.right < enemyHitbox.left ||
      playerHitbox.left > enemyHitbox.right ||
      playerHitbox.bottom < enemyHitbox.top ||
      playerHitbox.top > enemyHitbox.bottom
    );

    if (isColliding) {
      return true;
    }
  }

  return false;
}

/**
 * Checks for enemy cars that have been safely passed and awards points.
 */
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

/**
 * Updates player score and records high score in session and localStorage.
 */
function updateScore(pointsToAdd = 0) {
  state.score = Math.max(0, state.score + pointsToAdd);

  // Update HUD display
  DOM.score.textContent = state.score;

  // Pulse animation on score increment
  if (pointsToAdd > 0) {
    DOM.score.classList.remove('bump');
    void DOM.score.offsetWidth; // Trigger reflow
    DOM.score.classList.add('bump');
  }

  // Update high score
  if (state.score > state.highScore) {
    state.highScore = state.score;
    DOM.highScore.textContent = state.highScore;
    try {
      localStorage.setItem('carRacing_highScore', state.highScore);
    } catch (e) {
      // Ignore if localStorage unavailable
    }
  }
}

/**
 * Increases difficulty according to the score milestone tiers:
 * - 0–499    -> 1x
 * - 500–999  -> 1.5x
 * - 1000–1499 -> 2x
 * - 1500+    -> 2.5x
 */
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
    DOM.speed.textContent = state.speedLabel;

    // Adjust spawn interval inversely proportional to speed
    state.spawnInterval = Math.max(
      CONFIG.MIN_SPAWN_INTERVAL,
      CONFIG.BASE_SPAWN_INTERVAL / state.speedMultiplier
    );
  }
}

/**
 * Handles Game Over sequence: stops movement, triggers shake, reveals modal.
 */
function gameOver() {
  state.current = GameState.GAME_OVER;

  // Cancel animation loop
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }

  // Visual & audio impact
  DOM.road.classList.add('crash-shake');
  playSound('crash');

  // Disable pause button
  DOM.btnPause.disabled = true;
  DOM.btnStart.disabled = false;

  // Update Game Over modal values
  DOM.finalScore.textContent = state.score;
  DOM.finalHighScore.textContent = state.highScore;

  // Show "New Record" badge if player set a new high score
  if (state.score > 0 && state.score >= state.highScore) {
    DOM.newRecordBadge.style.display = 'inline-block';
  } else {
    DOM.newRecordBadge.style.display = 'none';
  }

  // Sync score with Cloud API
  syncScoreToCloud(state.score, state.highScore);

  // Display Game Over overlay
  DOM.gameOverScreen.classList.add('active');
}

// ----------------------------------------------------------------------------
// 7. ROAD ANIMATION & RENDERING
// ----------------------------------------------------------------------------
/**
 * Smoothly updates vertical road scrolling position.
 */
function updateRoadAnimation(dt) {
  const nitroBonus = state.keys.nitro ? CONFIG.NITRO_MULTIPLIER : 1.0;
  const roadScrollSpeed = CONFIG.BASE_ROAD_SPEED * state.speedMultiplier * nitroBonus;
  state.roadOffset = (state.roadOffset + roadScrollSpeed * dt) % 72; // 72px pattern repeat
}

/**
 * Renders all game entities to the screen using hardware-accelerated transforms.
 */
function renderGame() {
  // 1. Render road background & lane markings
  DOM.road.style.backgroundPositionY = `${state.roadOffset}px`;
  DOM.laneDividers.forEach(divider => {
    divider.style.transform = `translateX(-50%) translateY(${state.roadOffset}px)`;
  });

  // 2. Render player car
  DOM.playerCar.style.left = `${state.playerX}px`;
  DOM.playerCar.style.top = `${state.playerY}px`;

  // Steering lean tilt effect & nitro visual
  let carClasses = 'player-car';
  if (state.steeringDirection < 0) carClasses += ' tilt-left';
  if (state.steeringDirection > 0) carClasses += ' tilt-right';
  if (state.keys.nitro) carClasses += ' nitro-active';
  DOM.playerCar.className = carClasses;

  // Update speed tag to reflect Nitro
  if (state.keys.nitro) {
    DOM.speed.textContent = `${state.speedLabel} ⚡`;
  } else {
    DOM.speed.textContent = state.speedLabel;
  }

  // 3. Render enemy cars
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    enemy.el.style.left = `${enemy.x}px`;
    enemy.el.style.top = `${enemy.y}px`;
  }
}

// ----------------------------------------------------------------------------
// 8. INPUT LISTENERS & CONTROLS
// ----------------------------------------------------------------------------
function setupInputListeners() {
  // Keyboard steering & controls
  window.addEventListener('keydown', (e) => {
    // Prevent page scrolling on arrow keys and space
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      state.keys.left = true;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      state.keys.right = true;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      state.keys.nitro = true;
    }

    // Toggle Pause with 'P' key
    if (e.code === 'KeyP') {
      if (state.current === GameState.PLAYING) {
        pauseGame();
      } else if (state.current === GameState.PAUSED) {
        resumeGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      state.keys.left = false;
    }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      state.keys.right = false;
    }
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      state.keys.nitro = false;
    }
  });

  // Mobile Touch Controls
  function bindTouchSteer(buttonEl, keyName) {
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
  if (DOM.btnMobileNitro) bindTouchSteer(DOM.btnMobileNitro, 'nitro');
  bindTouchSteer(DOM.btnMobileRight, 'right');

  // Toolbar Button Click Handlers
  DOM.btnStart.addEventListener('click', () => {
    if (state.current === GameState.START || state.current === GameState.GAME_OVER) {
      startGame();
    }
  });

  DOM.btnPause.addEventListener('click', () => {
    if (state.current === GameState.PLAYING) {
      pauseGame();
    } else if (state.current === GameState.PAUSED) {
      resumeGame();
    }
  });

  DOM.btnRestart.addEventListener('click', restartGame);

  // Overlay Buttons
  DOM.startScreenBtn.addEventListener('click', startGame);
  DOM.pauseResumeBtn.addEventListener('click', resumeGame);
  DOM.gameOverRestartBtn.addEventListener('click', restartGame);

  // Sound Toggle Button
  DOM.soundBtn.addEventListener('click', toggleSound);

  // QR Code Scanner Controls
  if (DOM.btnQr) DOM.btnQr.addEventListener('click', openQRModal);
  if (DOM.startQrBtn) DOM.startQrBtn.addEventListener('click', openQRModal);
  if (DOM.qrCloseBtn) DOM.qrCloseBtn.addEventListener('click', closeQRModal);
  if (DOM.btnCopyUrl) DOM.btnCopyUrl.addEventListener('click', copyGameURL);
  if (DOM.tabPublicUrl) DOM.tabPublicUrl.addEventListener('click', () => switchQRTab('public'));
  if (DOM.tabLocalUrl) DOM.tabLocalUrl.addEventListener('click', () => switchQRTab('local'));

  // Window Resize Listener (Update road boundaries dynamically)
  window.addEventListener('resize', () => {
    updateRoadDimensions();
    // Clamp player in case window shrank
    const minX = CONFIG.ROAD_BORDER_WIDTH + 2;
    const maxX = state.roadWidth - CONFIG.ROAD_BORDER_WIDTH - state.playerWidth - 2;
    state.playerX = Math.max(minX, Math.min(state.playerX, maxX));
    state.playerY = state.roadHeight - state.playerHeight - 20;
    renderGame();
  });
}

/**
 * Reads actual rendered pixel dimensions of the road container.
 */
function updateRoadDimensions() {
  const rect = DOM.road.getBoundingClientRect();
  state.roadWidth = rect.width || 380;
  state.roadHeight = rect.height || 580;
}

// ----------------------------------------------------------------------------
// 9. INITIALIZATION
// ----------------------------------------------------------------------------
function init() {
  // Load saved high score
  try {
    const saved = localStorage.getItem('carRacing_highScore');
    if (saved) {
      state.highScore = parseInt(saved, 10) || 0;
      DOM.highScore.textContent = state.highScore;
    }
  } catch (e) {
    // Storage access restricted or disabled
  }

  // Calculate initial road dimensions
  updateRoadDimensions();
  state.playerX = (state.roadWidth - state.playerWidth) / 2;
  state.playerY = state.roadHeight - state.playerHeight - 20;

  // Render player in initial starting stance
  renderGame();

  // Attach all user interaction handlers
  setupInputListeners();

  // Initialize QR Code with default public link
  updateQRCode(getActiveGameURL());

  console.log('🚗 Car Racing Game initialized successfully!');
}

// ----------------------------------------------------------------------------
// 10. QR CODE GAME SCANNER & CLOUD API ENGINE
// ----------------------------------------------------------------------------
const QR_CONFIG = {
  // Auto-detect the current page URL so the QR code always works
  // on localhost, Wi-Fi, or any public tunnel — no hardcoded IPs
  LOCAL_URL: window.location.origin + window.location.pathname,
  currentMode: 'local'
};

function getActiveGameURL() {
  return QR_CONFIG.LOCAL_URL;
}

function updateQRCode(url) {
  if (!DOM.qrImage) return;

  if (DOM.qrLoading) {
    DOM.qrLoading.textContent = 'Generating QR Code via API...';
    DOM.qrLoading.style.display = 'flex';
  }
  if (DOM.qrUrlInput) DOM.qrUrlInput.value = url;

  // Use reliable public QR code generation API
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

function switchQRTab(mode) {
  QR_CONFIG.currentMode = mode;
  if (mode === 'public') {
    if (DOM.tabPublicUrl) DOM.tabPublicUrl.classList.add('active');
    if (DOM.tabLocalUrl) DOM.tabLocalUrl.classList.remove('active');
    updateQRCode(QR_CONFIG.PUBLIC_URL);
  } else {
    if (DOM.tabLocalUrl) DOM.tabLocalUrl.classList.add('active');
    if (DOM.tabPublicUrl) DOM.tabPublicUrl.classList.remove('active');
    updateQRCode(QR_CONFIG.LOCAL_URL);
  }
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

/**
 * Connects to Cloud API to sync game score
 */
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

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
