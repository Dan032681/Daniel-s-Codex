const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const levelText = document.getElementById('levelText');
const healthText = document.getElementById('healthText');
const ammoText = document.getElementById('ammoText');
const scoreText = document.getElementById('scoreText');
const zombieText = document.getElementById('zombieText');
const statusText = document.getElementById('statusText');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

const MAX_LEVEL = 10;
const MAX_AMMO = 12;
let mouseAim = 0;
let running = false;
let paused = false;
let lastTime = 0;

const player = {
  hp: 100,
  ammo: MAX_AMMO,
  score: 0,
  level: 1,
};

let enemies = [];
let enemyId = 0;

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContextClass ? new AudioContextClass() : null;
let musicOn = true;
let musicNodes = [];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function playTone(freq = 220, duration = 0.1, type = 'square', gainValue = 0.05) {
  if (!audioCtx) {
    return;
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function playShoot() {
  playTone(200, 0.06, 'sawtooth', 0.08);
  playTone(100, 0.07, 'triangle', 0.04);
}

function playHit() {
  playTone(90, 0.15, 'square', 0.08);
}

function playZombieGrowl() {
  playTone(rand(70, 110), 0.2, 'sawtooth', 0.04);
}

function playWinFanfare() {
  [440, 554, 659, 880].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.18, 'triangle', 0.05), i * 110);
  });
}

function stopMusic() {
  musicNodes.forEach((n) => {
    try {
      n.osc.stop();
    } catch (_error) {
      // oscillator may already be stopped
    }
  });
  musicNodes = [];
}

function startMusicLoop() {
  if (!audioCtx || !musicOn) {
    return;
  }
  stopMusic();
  const bass = audioCtx.createOscillator();
  const lead = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  const leadGain = audioCtx.createGain();

  bass.type = 'triangle';
  lead.type = 'square';
  bass.frequency.value = 82;
  lead.frequency.value = 164;
  bassGain.gain.value = 0.02;
  leadGain.gain.value = 0.012;

  bass.connect(bassGain);
  lead.connect(leadGain);
  bassGain.connect(audioCtx.destination);
  leadGain.connect(audioCtx.destination);

  bass.start();
  lead.start();
  musicNodes.push({ osc: bass, gain: bassGain }, { osc: lead, gain: leadGain });

  const pattern = [164, 196, 220, 196, 247, 220, 196, 164];
  let step = 0;
  const pulse = () => {
    if (!running || paused || !musicOn || !audioCtx) {
      return;
    }
    lead.frequency.setValueAtTime(pattern[step % pattern.length], audioCtx.currentTime);
    step += 1;
    setTimeout(pulse, 380);
  };
  pulse();
}

function makeEnemy(isBoss = false) {
  const levelFactor = player.level;
  const hp = isBoss ? 120 + levelFactor * 30 : 20 + levelFactor * 8;
  return {
    id: enemyId += 1,
    x: rand(-0.8, 0.8),
    depth: rand(0.9, 1.7),
    speed: (isBoss ? 0.04 : 0.07) + levelFactor * (isBoss ? 0.004 : 0.01),
    hp,
    maxHp: hp,
    radius: isBoss ? 0.16 : 0.08,
    damage: isBoss ? 20 : 8 + Math.floor(levelFactor / 2),
    isBoss,
    wobbleSeed: rand(0, Math.PI * 2),
  };
}

function spawnWave() {
  enemies = [];
  const level = player.level;
  const count = level === MAX_LEVEL ? 1 : 4 + level * 2;
  const isBossLevel = level === MAX_LEVEL;
  for (let i = 0; i < count; i += 1) {
    enemies.push(makeEnemy(isBossLevel));
  }
  zombieText.textContent = String(enemies.length);
  statusText.textContent = isBossLevel ? 'BOSS LEVEL: Mutant Overlord incoming!' : `Level ${level}: Hold the line!`;
}

function updateHud() {
  levelText.textContent = `${player.level} / ${MAX_LEVEL}`;
  healthText.textContent = String(Math.max(player.hp, 0));
  ammoText.textContent = `${player.ammo} / ${MAX_AMMO}`;
  scoreText.textContent = String(player.score);
  zombieText.textContent = String(enemies.length);
}

function reload() {
  player.ammo = MAX_AMMO;
  statusText.textContent = 'Reloaded.';
  playTone(320, 0.08, 'triangle', 0.05);
  updateHud();
}

function shoot() {
  if (!running || paused) {
    return;
  }

  if (player.ammo <= 0) {
    statusText.textContent = 'Out of ammo! Press R to reload.';
    playTone(110, 0.1, 'square', 0.04);
    return;
  }

  player.ammo -= 1;
  playShoot();

  const hit = enemies
    .filter((enemy) => Math.abs(enemy.x - mouseAim) < enemy.radius)
    .sort((a, b) => a.depth - b.depth)[0];

  if (hit) {
    const damage = 18 + player.level * 2;
    hit.hp -= damage;
    statusText.textContent = hit.isBoss ? `Boss hit for ${damage}!` : `Zombie hit for ${damage}!`;
    if (hit.hp <= 0) {
      player.score += hit.isBoss ? 1500 : 100 + player.level * 25;
      enemies = enemies.filter((e) => e.id !== hit.id);
      playZombieGrowl();
      statusText.textContent = hit.isBoss ? 'Boss destroyed! Evac secured!' : 'Zombie eliminated!';
    }
  } else {
    statusText.textContent = 'Missed shot.';
  }

  updateHud();
  checkLevelComplete();
}

function gameOver(message) {
  running = false;
  paused = false;
  stopMusic();
  statusText.textContent = message;
}

function checkLevelComplete() {
  if (enemies.length > 0) {
    return;
  }

  if (player.level >= MAX_LEVEL) {
    playWinFanfare();
    gameOver('You defeated the final boss and survived all 10 levels!');
    return;
  }

  player.level += 1;
  player.ammo = MAX_AMMO;
  player.hp = Math.min(100, player.hp + 10);
  playWinFanfare();
  spawnWave();
  updateHud();
}

function updateEnemies(delta) {
  enemies.forEach((enemy) => {
    enemy.depth -= enemy.speed * delta;
    enemy.x += Math.sin(performance.now() * 0.002 + enemy.wobbleSeed) * 0.0015;

    if (enemy.depth <= 0.2) {
      player.hp -= enemy.damage;
      enemy.depth = rand(1.0, 1.8);
      enemy.x = rand(-0.8, 0.8);
      playHit();
      statusText.textContent = enemy.isBoss ? 'Boss slam! Massive damage taken!' : 'Zombie reached you!';
    }
  });

  if (player.hp <= 0) {
    gameOver('Mission failed. You were overrun by zombies.');
  }
}

function drawScene(time) {
  const gradientSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradientSky.addColorStop(0, '#1f2f4a');
  gradientSky.addColorStop(0.55, '#0f1627');
  gradientSky.addColorStop(1, '#25150f');
  ctx.fillStyle = gradientSky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ground perspective lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  for (let i = 1; i <= 12; i += 1) {
    const y = canvas.height * (0.55 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const sorted = [...enemies].sort((a, b) => b.depth - a.depth);
  sorted.forEach((enemy) => {
    const perspective = 1 / enemy.depth;
    const size = enemy.isBoss ? 230 : 135;
    const drawSize = size * perspective;
    const x = canvas.width * (0.5 + enemy.x * 0.45) - drawSize / 2;
    const y = canvas.height * 0.66 - drawSize * 0.8;

    const pulse = Math.sin(time * 0.004 + enemy.wobbleSeed) * 0.08 + 0.92;

    ctx.save();
    ctx.translate(x + drawSize / 2, y + drawSize / 2);
    ctx.scale(pulse, 1);

    // body
    ctx.fillStyle = enemy.isBoss ? '#5a1632' : '#436f52';
    ctx.beginPath();
    ctx.ellipse(0, drawSize * 0.1, drawSize * 0.33, drawSize * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = enemy.isBoss ? '#9e2f5d' : '#8fcf91';
    ctx.beginPath();
    ctx.arc(0, -drawSize * 0.28, drawSize * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.fillStyle = '#ff324d';
    ctx.beginPath();
    ctx.arc(-drawSize * 0.07, -drawSize * 0.3, drawSize * 0.03, 0, Math.PI * 2);
    ctx.arc(drawSize * 0.07, -drawSize * 0.3, drawSize * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // hp bar
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(-drawSize * 0.3, -drawSize * 0.57, drawSize * 0.6, drawSize * 0.05);
    ctx.fillStyle = enemy.isBoss ? '#ff5e73' : '#68e3ff';
    ctx.fillRect(-drawSize * 0.3, -drawSize * 0.57, drawSize * 0.6 * hpRatio, drawSize * 0.05);

    ctx.restore();
  });

  if (!running) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '700 42px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('DEADLINE OUTBREAK', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '24px Segoe UI';
    ctx.fillText('Press Start Mission to begin', canvas.width / 2, canvas.height / 2 + 26);
  }

  if (paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '700 52px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
  }
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }

  const delta = Math.min(2.2, (timestamp - lastTime) / 16.67);
  lastTime = timestamp;

  if (running && !paused) {
    updateEnemies(delta);
    checkLevelComplete();
    updateHud();
  }

  drawScene(timestamp);
  requestAnimationFrame(loop);
}

function startMission() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  running = true;
  paused = false;
  player.hp = 100;
  player.ammo = MAX_AMMO;
  player.score = 0;
  player.level = 1;
  spawnWave();
  startMusicLoop();
  updateHud();
}

function restartCampaign() {
  gameOver('Campaign reset. Press Start Mission.');
  player.hp = 100;
  player.ammo = MAX_AMMO;
  player.score = 0;
  player.level = 1;
  enemies = [];
  updateHud();
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  mouseAim = (x - 0.5) * 2;
});

canvas.addEventListener('click', shoot);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    shoot();
  }
  if (event.key.toLowerCase() === 'r') {
    reload();
  }
  if (event.key.toLowerCase() === 'm') {
    musicOn = !musicOn;
    if (musicOn) {
      startMusicLoop();
      statusText.textContent = 'Music on';
    } else {
      stopMusic();
      statusText.textContent = 'Music off';
    }
  }
});

startBtn.addEventListener('click', startMission);
pauseBtn.addEventListener('click', () => {
  if (!running) {
    return;
  }
  paused = !paused;
  statusText.textContent = paused ? 'Paused.' : 'Back in action.';
  if (!paused && musicOn) {
    startMusicLoop();
  }
});
restartBtn.addEventListener('click', restartCampaign);

updateHud();
requestAnimationFrame(loop);
