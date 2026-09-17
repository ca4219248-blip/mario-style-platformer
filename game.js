/* ============================================================
 * Super Pixel Bros — a Mario-style platformer
 * Built with vanilla JavaScript + HTML5 Canvas. No dependencies.
 * License: MIT
 * ============================================================ */

(() => {
  "use strict";

  // ---------- Constants ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 960
  const H = canvas.height;  // 540
  const TILE = 40;
  const GRAVITY = 0.55;
  const MOVE_SPEED = 4.6;
  const JUMP_VEL = -13.5;
  const MAX_FALL = 15;
  const ENEMY_SPEED = 1.2;

  // Level legend:
  //   # solid ground   B brick   ? question block   = platform
  //   P pipe           o coin    g goomba           F flag
  //   M player start
  const LEVEL = [
    "                                                                                                    ",
    "                                                                                                    ",
    "                                                                                                    ",
    "                                                                                                    ",
    "                                                                                                    ",
    "                                        o o o                                                       ",
    "                                       =======                                                      ",
    "                                    B  B?B  B                                    o o o             ",
    "                                                                                          ======    ",
    "                                                                  o o o                          ",
    "                       o o                        g                                        F        ",
    "            o o      ========                                        o o                  FFF      ",
    "           =====             B?B          g        oooo      ==========        P       FFF     ",
    "                 g                    ==============        PPPPPP           PPP      FFF       ",
    "        B?B                  g    M                                                        ",
    "###############################   #######################   ################################################",
    "###############################   #######################   ################################################",
  ];

  const ROWS = LEVEL.length;
  const COLS = Math.max(...LEVEL.map((r) => r.length));
  const WORLD_W = COLS * TILE;

  // ---------- Level state ----------
  let tiles = [];       // 2D array of tile chars
  let coins = [];       // {x,y,anim}
  let goombas = [];     // {x,y,vx,vy,alive,squashT}
  let popCoins = [];    // popped coin animations {x,y,vy}
  let bumps = [];       // block bump animations {row,col,t}

  // ---------- Player ----------
  const player = {
    x: 0, y: 0, w: 28, h: 38,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    walkT: 0,
  };

  // ---------- Game state ----------
  let state = "start"; // start | play | dead | gameover | win
  let score = 0;
  let coinCount = 0;
  let lives = 3;
  let timeLeft = 300;
  let deathT = 0;
  let camX = 0;
  let frameCount = 0;
  let flagT = 0;

  // ---------- Input ----------
  const keys = {};
  addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
      e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === "Enter") {
      if (state === "start" || state === "gameover" || state === "win") startGame();
    }
    // jump buffering: jump the moment key is pressed
    if (isJumpKey(e.key) && state === "play") tryJump();
  });
  addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  const isJumpKey = (k) =>
    k === " " || k === "ArrowUp" || k.toLowerCase() === "w";

  function tryJump() {
    if (player.onGround) {
      player.vy = JUMP_VEL;
      player.onGround = false;
      sfx.jump();
    }
  }

  // ---------- Sound (WebAudio, no assets) ----------
  const AC = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  function beep(freq, dur, type = "square", vol = 0.08, slide = 0) {
    try {
      if (!audioCtx && AC) audioCtx = new AC();
      if (!audioCtx) return;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audioCtx.currentTime + dur);
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* audio not available */ }
  }
  const sfx = {
    jump:  () => beep(320, 0.15, "square", 0.06, 260),
    coin:  () => { beep(988, 0.08); setTimeout(() => beep(1319, 0.25), 80); },
    stomp: () => beep(200, 0.15, "triangle", 0.1, -150),
    bump:  () => beep(140, 0.1, "square", 0.07),
    die:   () => { beep(500, 0.2, "sawtooth", 0.08, -400); setTimeout(() => beep(250, 0.4, "sawtooth", 0.08, -200), 200); },
    win:   () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 150)),
  };

  // ---------- Setup / reset ----------
  function startGame() {
    score = 0; coinCount = 0; lives = 3; timeLeft = 300;
    loadLevel();
    state = "play";
  }

  function loadLevel() {
    tiles = [];
    for (let r = 0; r < ROWS; r++) {
      tiles[r] = [];
      for (let c = 0; c < COLS; c++) tiles[r][c] = LEVEL[r][c] || " ";
    }
    coins = []; goombas = []; popCoins = []; bumps = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = tiles[r][c];
        const x = c * TILE, y = r * TILE;
        if (ch === "M") { player.x = x; player.y = y; tiles[r][c] = " "; }
        if (ch === "o") { coins.push({ x: x + 10, y: y + 10, anim: Math.random() * 6 }); tiles[r][c] = " "; }
        if (ch === "g") { goombas.push({ x: x + 4, y: y + 8, w: 32, h: 32, vx: -ENEMY_SPEED, vy: 0, alive: true, squashT: 0 }); tiles[r][c] = " "; }
      }
    }
    player.vx = 0; player.vy = 0; player.onGround = false; player.facing = 1;
    camX = 0; deathT = 0; flagT = 0;
  }

  // ---------- Tile helpers ----------
  const solidAt = (r, c) => {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= COLS) return true; // side walls
    const ch = tiles[r][c];
    return ch === "#" || ch === "B" || ch === "?" || ch === "=" || ch === "P";
  };
  const tileAt = (r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? tiles[r][c] : " ";

  function rectVsTiles(px, py, pw, ph) {
    // returns overlap info for a rect against solids
    const r0 = Math.floor(py / TILE), r1 = Math.floor((py + ph - 1) / TILE);
    const c0 = Math.floor(px / TILE), c1 = Math.floor((px + pw - 1) / TILE);
    const hits = [];
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (solidAt(r, c)) hits.push({ r, c });
    return hits;
  }

  // ---------- Update ----------
  function update() {
    frameCount++;

    if (state === "start" || state === "gameover" || state === "win") return;

    if (state === "dead") {
      // death animation: player flies up then falls
      deathT++;
      player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
      player.y += player.vy;
      if (deathT > 110) {
        if (lives <= 0) state = "gameover";
        else { loadLevel(); state = "play"; }
      }
      return;
    }

    // ----- timer -----
    if (frameCount % 60 === 0 && timeLeft > 0) timeLeft--;
    if (timeLeft === 0) killPlayer();

    // ----- player movement -----
    const left = keys["arrowleft"] || keys["a"];
    const right = keys["arrowright"] || keys["d"];
    if (left)  { player.vx = -MOVE_SPEED; player.facing = -1; }
    else if (right) { player.vx = MOVE_SPEED; player.facing = 1; }
    else player.vx = 0;

    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    if (player.vy < 0) player.vy *= 0.995; // slight float at jump apex

    // horizontal move + collide
    player.x += player.vx;
    for (const h of rectVsTiles(player.x, player.y, player.w, player.h)) {
      if (player.vx > 0) player.x = h.c * TILE - player.w;
      else if (player.vx < 0) player.x = (h.c + 1) * TILE;
      player.vx = 0;
    }
    player.x = Math.max(0, Math.min(player.x, WORLD_W - player.w));

    // vertical move + collide
    player.onGround = false;
    player.y += player.vy;
    for (const h of rectVsTiles(player.x, player.y, player.w, player.h)) {
      if (player.vy > 0) { // landing
        player.y = h.r * TILE - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) { // head bump
        player.y = (h.r + 1) * TILE;
        player.vy = 0;
        hitBlockFromBelow(h.r, h.c);
      }
    }

    if (player.onGround) player.walkT += Math.abs(player.vx) * 0.08;

    // fell off world
    if (player.y > ROWS * TILE + 100) killPlayer();

    // ----- camera -----
    const targetCam = player.x - W / 2 + player.w / 2;
    camX = Math.max(0, Math.min(targetCam, WORLD_W - W));

    // ----- coins -----
    for (const cn of coins) cn.anim += 0.15;
    for (let i = coins.length - 1; i >= 0; i--) {
      const cn = coins[i];
      if (overlap(player.x, player.y, player.w, player.h, cn.x, cn.y, 20, 20)) {
        coins.splice(i, 1);
        coinCount++; score += 200;
        sfx.coin();
      }
    }

    // popped coins from ? blocks
    for (let i = popCoins.length - 1; i >= 0; i--) {
      const pc = popCoins[i];
      pc.vy += 0.4; pc.y += pc.vy;
      if (pc.vy > 8) popCoins.splice(i, 1);
    }

    // block bump animations
    for (let i = bumps.length - 1; i >= 0; i--) {
      bumps[i].t += 0.15;
      if (bumps[i].t >= 1) bumps.splice(i, 1);
    }

    // ----- goombas -----
    for (const g of goombas) {
      if (!g.alive) {
        if (g.squashT > 0) g.squashT--;
        continue;
      }
      // only update when near camera
      if (g.x < camX - 100 || g.x > camX + W + 100) continue;

      g.vy = Math.min(g.vy + GRAVITY, MAX_FALL);
      g.x += g.vx;
      for (const h of rectVsTiles(g.x, g.y, g.w, g.h)) {
        if (g.vx > 0) g.x = h.c * TILE - g.w; else g.x = (h.c + 1) * TILE;
        g.vx *= -1;
      }
      g.y += g.vy;
      let grounded = false;
      for (const h of rectVsTiles(g.x, g.y, g.w, g.h)) {
        if (g.vy > 0) { g.y = h.r * TILE - g.h; g.vy = 0; grounded = true; }
        else { g.y = (h.r + 1) * TILE; g.vy = 0; }
      }
      // turn at ledges
      if (grounded) {
        const aheadX = g.vx > 0 ? g.x + g.w + 2 : g.x - 2;
        const rBelow = Math.floor((g.y + g.h + 2) / TILE);
        if (!solidAt(rBelow, Math.floor(aheadX / TILE)) &&
            tileAt(rBelow, Math.floor(aheadX / TILE)) !== "F") g.vx *= -1;
      }
      if (g.y > ROWS * TILE + 100) g.alive = false;

      // vs player
      if (overlap(player.x, player.y, player.w, player.h, g.x, g.y, g.w, g.h)) {
        const stomped = player.vy > 1 && player.y + player.h - g.y < 20;
        if (stomped) {
          g.alive = false; g.squashT = 30;
          player.vy = -9;
          score += 100;
          sfx.stomp();
        } else {
          killPlayer();
        }
      }
    }

    // ----- flag / win -----
    if (tileAt(Math.floor((player.y + player.h / 2) / TILE), Math.floor((player.x + player.w / 2) / TILE)) === "F" ||
        tileAt(Math.floor(player.y / TILE), Math.floor((player.x + player.w / 2) / TILE)) === "F") {
      state = "win";
      score += Math.max(0, timeLeft) * 10;
      sfx.win();
    }
  }

  function hitBlockFromBelow(r, c) {
    const ch = tileAt(r, c);
    if (ch === "?") {
      tiles[r][c] = "x"; // used block
      popCoins.push({ x: c * TILE + 10, y: r * TILE - 30, vy: -8 });
      coinCount++; score += 200;
      bumps.push({ r, c, t: 0 });
      sfx.coin();
    } else if (ch === "B") {
      bumps.push({ r, c, t: 0 });
      sfx.bump();
    }
  }

  function killPlayer() {
    if (state !== "play") return;
    state = "dead";
    lives--;
    player.vy = -11;
    sfx.die();
  }

  function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  // ---------- Drawing ----------
  function draw() {
    // sky
    ctx.fillStyle = "#5c94fc";
    ctx.fillRect(0, 0, W, H);

    // parallax hills
    ctx.fillStyle = "#00a844";
    for (let i = 0; i < 8; i++) {
      const hx = i * 300 - (camX * 0.4) % 300 - 150;
      ctx.beginPath();
      ctx.arc(hx + 150, H - 100, 110, Math.PI, 0);
      ctx.fill();
    }
    // clouds
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 10; i++) {
      const cx = i * 380 - (camX * 0.25) % 380 - 200;
      const cy = 60 + (i % 3) * 45;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, 7); ctx.arc(cx + 24, cy - 10, 26, 0, 7); ctx.arc(cx + 52, cy, 20, 0, 7);
      ctx.fill();
    }

    if (state === "start") { drawCenterScreen("SUPER PIXEL BROS", "Press ENTER to start", "Arrows/WASD to move · Space to jump"); return; }
    if (state === "gameover") { drawCenterScreen("GAME OVER", "Press ENTER to restart", "Score: " + score); return; }
    if (state === "win") { drawCenterScreen("YOU WIN! 🏁", "Press ENTER to play again", "Score: " + score + " · Coins: " + coinCount); return; }

    ctx.save();
    ctx.translate(-Math.floor(camX), 0);

    // tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = tiles[r][c];
        if (ch === " ") continue;
        const bump = bumps.find((b) => b.r === r && b.c === c);
        const dy = bump ? -Math.sin(bump.t * Math.PI) * 10 : 0;
        drawTile(ch, c * TILE, r * TILE + dy);
      }
    }

    // coins
    for (const cn of coins) drawCoin(cn.x, cn.y, cn.anim);
    for (const pc of popCoins) drawCoin(pc.x, pc.y, 0);

    // goombas
    for (const g of goombas) drawGoomba(g);

    // flag pole drawn on top
    drawFlag();

    // player
    drawPlayer();

    ctx.restore();

    // HUD
    drawHUD();

    // death fade
    if (state === "dead") {
      ctx.fillStyle = "rgba(0,0,0," + Math.min(0.5, deathT / 200) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawTile(ch, x, y) {
    if (ch === "#") { // ground
      ctx.fillStyle = "#c84c0c"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#e8926c"; ctx.fillRect(x, y, TILE, 8);
      ctx.fillStyle = "#8c2f04";
      ctx.fillRect(x + 6, y + 14, 10, 6); ctx.fillRect(x + 24, y + 26, 10, 6);
    } else if (ch === "B") { // brick
      ctx.fillStyle = "#d2691e"; ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "#7a3b10"; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.beginPath();
      ctx.moveTo(x, y + 20); ctx.lineTo(x + TILE, y + 20);
      ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y + 20);
      ctx.moveTo(x + 10, y + 20); ctx.lineTo(x + 10, y + TILE);
      ctx.moveTo(x + 30, y + 20); ctx.lineTo(x + 30, y + TILE);
      ctx.stroke();
    } else if (ch === "?") { // question block
      ctx.fillStyle = "#f5b800"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#8a5a00";
      for (const [dx, dy] of [[2, 2], [TILE - 8, 2], [2, TILE - 8], [TILE - 8, TILE - 8]]) ctx.fillRect(x + dx, y + dy, 6, 6);
      ctx.fillStyle = "#8a5a00"; ctx.font = "bold 26px Courier New"; ctx.textAlign = "center";
      ctx.fillText("?", x + TILE / 2, y + TILE - 10);
    } else if (ch === "x") { // used block
      ctx.fillStyle = "#9c6b30"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#6e4a1e"; ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    } else if (ch === "=") { // platform
      ctx.fillStyle = "#43a047"; ctx.fillRect(x, y, TILE, 18);
      ctx.fillStyle = "#2e7d32"; ctx.fillRect(x, y + 18, TILE, 6);
      ctx.fillStyle = "#66bb6a"; ctx.fillRect(x, y, TILE, 5);
    } else if (ch === "P") { // pipe
      ctx.fillStyle = "#00a651"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#008c44"; ctx.fillRect(x + TILE - 12, y, 12, TILE);
      ctx.fillStyle = "#7ee08a"; ctx.fillRect(x + 5, y, 7, TILE);
    } else if (ch === "F") { // flag pole base
      ctx.fillStyle = "#b0bec5"; ctx.fillRect(x + TILE / 2 - 4, y, 8, TILE);
    }
  }

  function drawCoin(x, y, anim) {
    const w = Math.abs(Math.cos(anim)) * 18 + 4;
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 10, w / 2, 10, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 10, w / 2, 10, 0, 0, 7);
    ctx.stroke();
  }

  function drawGoomba(g) {
    if (!g.alive && g.squashT <= 0) return;
    const x = g.x, y = g.y;
    if (!g.alive) { // squashed
      ctx.fillStyle = "#8d4e2a";
      ctx.fillRect(x, y + g.h - 12, g.w, 12);
      return;
    }
    // body
    ctx.fillStyle = "#8d4e2a";
    ctx.beginPath();
    ctx.ellipse(x + g.w / 2, y + g.h / 2 - 2, g.w / 2, g.h / 2, 0, 0, 7);
    ctx.fill();
    // feet
    ctx.fillStyle = "#3e2723";
    const step = Math.sin(frameCount * 0.2) * 3;
    ctx.fillRect(x - 1, y + g.h - 7, 13, 7 + step);
    ctx.fillRect(x + g.w - 12, y + g.h - 7, 13, 7 - step);
    // eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 6, y + 8, 8, 10); ctx.fillRect(x + g.w - 14, y + 8, 8, 10);
    ctx.fillStyle = "#000";
    ctx.fillRect(x + 9, y + 11, 4, 6); ctx.fillRect(x + g.w - 11, y + 11, 4, 6);
    // angry brows
    ctx.fillStyle = "#000";
    ctx.fillRect(x + 5, y + 6, 9, 3); ctx.fillRect(x + g.w - 14, y + 6, 9, 3);
  }

  function drawFlag() {
    // find the flag pole (leftmost 'F' tile and its topmost row)
    let poleCol = -1, top = ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (tiles[r][c] === "F") { if (poleCol === -1) poleCol = c; if (r < top) top = r; }
      }
    }
    if (poleCol !== -1) {
      const px = poleCol * TILE + TILE / 2;
      ctx.fillStyle = "#78909c"; ctx.fillRect(px - 3, top * TILE, 6, (ROWS - top) * TILE);
      // flag cloth
      const wave = Math.sin(frameCount * 0.05) * 4;
      ctx.fillStyle = "#e53935";
      ctx.beginPath();
      ctx.moveTo(px - 3, top * TILE + 8);
      ctx.lineTo(px - 45 + wave, top * TILE + 24);
      ctx.lineTo(px - 3, top * TILE + 40);
      ctx.closePath();
      ctx.fill();
      // pole ball
      ctx.fillStyle = "#ffd93d";
      ctx.beginPath(); ctx.arc(px, top * TILE, 6, 0, 7); ctx.fill();
    }
  }

  function drawPlayer() {
    const x = player.x, y = player.y, f = player.facing;
    const dead = state === "dead";

    // cap
    ctx.fillStyle = "#e53935";
    ctx.fillRect(x - 1, y, 30, 8);
    ctx.fillRect(x + (f > 0 ? 18 : -6), y + 4, 16, 5); // brim
    // face
    ctx.fillStyle = "#ffcc80";
    ctx.fillRect(x + 2, y + 8, 24, 12);
    // eyes + moustache
    ctx.fillStyle = "#000";
    ctx.fillRect(x + (f > 0 ? 17 : 6), y + 10, 4, 5);
    ctx.fillRect(x + (f > 0 ? 12 : 8), y + 16, 14, 3);
    // shirt (blue)
    ctx.fillStyle = "#2962ff";
    ctx.fillRect(x, y + 20, 28, 12);
    // overalls (red buttons)
    ctx.fillStyle = "#ffd93d";
    ctx.fillRect(x + (f > 0 ? 6 : 8), y + 22, 4, 4);
    ctx.fillRect(x + (f > 0 ? 18 : 16), y + 22, 4, 4);
    // legs: running animation
    ctx.fillStyle = "#2962ff";
    if (player.onGround && Math.abs(player.vx) > 0.1) {
      const s = Math.sin(player.walkT);
      ctx.fillRect(x + 2, y + 32, 10, 6 + s * 3);
      ctx.fillRect(x + 16, y + 32, 10, 6 - s * 3);
    } else if (!player.onGround) {
      ctx.fillRect(x, y + 32, 11, 6);
      ctx.fillRect(x + 17, y + 30, 11, 6);
    } else {
      ctx.fillRect(x + 3, y + 32, 9, 6);
      ctx.fillRect(x + 16, y + 32, 9, 6);
    }
    // shoes
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(x + 1, y + 36, 13, 4);
    ctx.fillRect(x + 15, y + 36, 13, 4);
    if (dead) { // dizzy X eyes
      ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 10); ctx.lineTo(x + 14, y + 15);
      ctx.moveTo(x + 14, y + 10); ctx.lineTo(x + 8, y + 15);
      ctx.stroke();
    }
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + String(score).padStart(6, "0"), 16, 23);
    ctx.fillText("🪙 x" + coinCount, 240, 23);
    ctx.textAlign = "center";
    ctx.fillText("TIME " + Math.max(0, timeLeft), W / 2, 23);
    ctx.textAlign = "right";
    ctx.fillText("LIVES " + "❤".repeat(Math.max(0, lives)) || "LIVES 0", W - 16, 23);
    if (lives <= 0) { ctx.fillText("LIVES 0", W - 16, 23); }
  }

  function drawCenterScreen(title, sub, sub2) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd93d";
    ctx.font = "bold 56px Courier New";
    ctx.fillText(title, W / 2, H / 2 - 40);
    ctx.fillStyle = "#fff";
    ctx.font = "20px Courier New";
    ctx.fillText(sub, W / 2, H / 2 + 10);
    ctx.fillStyle = "#9ab";
    ctx.font = "16px Courier New";
    ctx.fillText(sub2, W / 2, H / 2 + 45);
  }

  // ---------- Main loop ----------
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loadLevel();
  loop();
})();
