(() => {
  let scene;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const safe = value => String(value || 'Oyuncu').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function destroy() {
    if (!scene) return;
    cancelAnimationFrame(scene.animation); clearInterval(scene.inputTimer);
    document.removeEventListener('keydown', scene.keydown); document.removeEventListener('keyup', scene.keyup);
    window.removeEventListener('blur', scene.blur);
    scene = null;
  }
  function render(game, id, send, header) {
    const root = document.querySelector('#activeGame');
    if (game.phase === 'lobby') {
      destroy();
      const online = player => game.players.includes(player) && window.hockeyOnlinePlayers?.includes(player);
      root.innerHTML = header + '<div class="hockey-seats">' + game.players.map((player, side) => `<div class="hockey-seat"><h3>${side === 0 ? '1. oyuncu' : '2. oyuncu'}</h3><p>${player ? safe(game.names[player]) + (player === id ? ' · SEN' : '') + (!online(player) ? ' · çevrimdışı' : '') : 'Boş'}</p><button class="subtle-button" data-hockey-side="${side}" ${player && player !== id && online(player) ? 'disabled' : ''}>${player === id ? 'Seçili' : 'Bu tarafta oyna'}</button></div>`).join('') + '</div><p class="review-hint">İlk 10 gol · Fare, dokunmatik veya yön tuşları</p>' + (game.players.includes(id) ? '<div class="hockey-lobby-actions"><button class="start-button" data-action="begin-hockey">Maçı başlat</button><button class="subtle-button" data-action="leave-hockey-seat">İzleyici ol</button></div>' : '<p class="review-hint">İzleyicisin.</p>');
      return;
    }
    if (!scene || scene.game.gameId !== game.gameId || !document.querySelector('#hockeyCanvas')) {
      destroy();
      root.innerHTML = header + '<div class="hockey-score"><span id="hockeyMe"></span><strong id="hockeyScore"></strong><span id="hockeyThem"></span></div><div class="hockey-table-wrap"><canvas id="hockeyCanvas" width="960" height="1520" tabindex="0" aria-label="Hava hokeyi masası. Raketi fare, parmak veya yön tuşlarıyla kontrol et."></canvas><div id="hockeyOverlay" class="hockey-overlay" role="status"></div></div><div class="hockey-footer"><span id="hockeyStatus"></span><button class="start-button hidden" id="hockeyRematch" data-action="restart-hockey">Tekrar oyna</button></div>';
      const canvas = document.querySelector('#hockeyCanvas');
      scene = { game, id, send, canvas, ctx: canvas.getContext('2d'), previous: game, received: performance.now(), target: null, predicted: null, seq: 0, keys: new Set(), lastDraw: performance.now(), lastSent: null };
      bind(scene);
      scene.animation = requestAnimationFrame(draw);
      canvas.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    update(game);
  }
  function update(game) {
    if (!scene || scene.game.gameId !== game.gameId || game.tick < scene.game.tick) return;
    const s = scene, old = s.game;
    s.previous = old; s.game = game; s.received = performance.now();
    s.side = game.players.indexOf(s.id);
    const bottom = s.side < 0 ? 0 : s.side, top = 1 - bottom;
    if (game.scores[0] + game.scores[1] !== old.scores[0] + old.scores[1] || game.phase !== old.phase) { s.target = null; s.predicted = null; s.lastSent = null; s.keys.clear(); }
    if (s.side >= 0) s.seq = Math.max(s.seq, game.paddles[s.side].inputSeq);
    document.querySelector('#hockeyMe').textContent = (game.names[game.players[bottom]] || 'Oyuncu') + (s.side >= 0 ? ' · SEN' : '');
    document.querySelector('#hockeyThem').textContent = game.names[game.players[top]] || 'Oyuncu';
    document.querySelector('#hockeyScore').textContent = `${game.scores[bottom]} : ${game.scores[top]}`;
    document.querySelector('#hockeyStatus').textContent = game.phase === 'finished' ? `${game.names[game.winner] || 'Oyuncu'} kazandı!` : s.side < 0 ? 'İzleyicisin · İlk 10 gol' : 'İlk 10 gol';
    document.querySelector('#hockeyRematch').classList.toggle('hidden', game.phase !== 'finished' || s.side < 0);
    s.canvas.style.touchAction = s.side >= 0 && game.phase === 'playing' ? 'none' : 'pan-y';
  }
  function bind(s) {
    const target = (x, y) => {
      if (s.side < 0 || s.game.phase !== 'playing') return;
      const margin = s.game.table.paddle + 6;
      s.target = { x: clamp(x, margin, 480 - margin), y: clamp(y, s.side === 0 ? 380 + margin : margin, s.side === 0 ? 760 - margin : 380 - margin) };
      s.predicted ||= { ...s.game.paddles[s.side] };
    };
    const pointer = event => {
      if (s.side < 0 || s.game.phase !== 'playing' || (event.pointerType !== 'mouse' && !s.canvas.hasPointerCapture(event.pointerId))) return;
      event.preventDefault();
      const rect = s.canvas.getBoundingClientRect();
      let x = (event.clientX - rect.left) / rect.width * 480, y = (event.clientY - rect.top) / rect.height * 760;
      if (s.side === 1) { x = 480 - x; y = 760 - y; }
      target(x, y);
    };
    s.canvas.onpointerdown = event => { if (s.side < 0 || s.game.phase !== 'playing') return; s.canvas.setPointerCapture(event.pointerId); s.canvas.focus({ preventScroll: true }); pointer(event); };
    s.canvas.onpointermove = pointer;
    s.keydown = event => { if (s.side < 0 || s.game.phase !== 'playing' || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return; const key = event.key.toLowerCase(); if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)) { event.preventDefault(); s.keys.add(key); } };
    s.keyup = event => s.keys.delete(event.key.toLowerCase());
    s.blur = () => { s.keys.clear(); };
    document.addEventListener('keydown', s.keydown); document.addEventListener('keyup', s.keyup); window.addEventListener('blur', s.blur);
    s.inputTimer = setInterval(() => {
      if (!s.target || s.side < 0 || s.game.phase !== 'playing') return;
      if (s.lastSent && Math.hypot(s.target.x - s.lastSent.x, s.target.y - s.lastSent.y) < .5) return;
      s.send({ type: 'move-hockey', gameId: s.game.gameId, x: s.target.x, y: s.target.y, seq: ++s.seq }); s.lastSent = { ...s.target };
    }, 33);
    s.setTarget = target;
  }
  function draw(now) {
    const s = scene; if (!s) return;
    const { ctx: c, game: g } = s, dt = Math.min(.05, (now - s.lastDraw) / 1000); s.lastDraw = now;
    const alpha = clamp((now - s.received) / 33, 0, 1);
    const point = (old, next) => ({ x: old.x + (next.x - old.x) * alpha, y: old.y + (next.y - old.y) * alpha });
    if (s.side >= 0 && g.phase === 'playing') {
      const keys = s.keys, direction = s.side === 1 ? -1 : 1;
      const dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      const dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      if (dx || dy) { const from = s.target || g.paddles[s.side]; s.setTarget(from.x + dx * direction * 850 * dt, from.y + dy * direction * 850 * dt); }
    }
    if (s.target && s.predicted) {
      const dx = s.target.x - s.predicted.x, dy = s.target.y - s.predicted.y, distance = Math.hypot(dx, dy), ratio = distance ? Math.min(1, g.table.paddleSpeed * dt / distance) : 0;
      s.predicted.x += dx * ratio; s.predicted.y += dy * ratio;
    }
    const colors = getComputedStyle(document.documentElement), accent = colors.getPropertyValue('--yellow').trim() || '#f2cf43';
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, 480, 760);
    if (s.side === 1) { c.translate(480, 760); c.rotate(Math.PI); }
    c.fillStyle = '#111820'; c.fillRect(0, 0, 480, 760);
    c.strokeStyle = '#344450'; c.lineWidth = 2; c.beginPath(); c.moveTo(8,380); c.lineTo(472,380); c.stroke();
    const circle = (x, y, r, fill, stroke) => { c.beginPath(); c.arc(x,y,r,0,Math.PI*2); if(fill) {c.fillStyle=fill;c.fill();} if(stroke) {c.strokeStyle=stroke;c.stroke();} };
    circle(240,380,65,null,'#344450'); circle(240,380,5,'#344450');
    c.lineWidth = 7; c.lineCap = 'round';
    c.strokeStyle = '#657582'; c.beginPath(); c.moveTo(150,0); c.lineTo(0,0); c.lineTo(0,760); c.lineTo(150,760); c.moveTo(330,760); c.lineTo(480,760); c.lineTo(480,0); c.lineTo(330,0); c.stroke();
    const sideColor = side => side === (s.side < 0 ? 0 : s.side) ? accent : '#76baff';
    for (const x of [150,330]) for (const y of [0,760]) circle(x,y,7,'#a5b3be');
    for (const side of [0,1]) {
      c.lineWidth = 5;
      c.strokeStyle = sideColor(side); c.beginPath(); c.moveTo(155,side===0?758:2); c.lineTo(325,side===0?758:2); c.stroke();
      c.lineWidth = 2; circle(240,side===0?760:0,95,null,'#344450');
      const p = side === s.side && s.predicted ? s.predicted : point(s.previous.paddles[side],g.paddles[side]);
      circle(p.x+2,p.y+5,29,'#0007'); circle(p.x,p.y,28,'#172633',sideColor(side)); circle(p.x,p.y,17,sideColor(side)); circle(p.x-4,p.y-5,5,'#ffffff55');
    }
    const puck = g.serveUntil > g.serverTime && g.scores[0]+g.scores[1] !== s.previous.scores[0]+s.previous.scores[1] ? g.puck : point(s.previous.puck,g.puck);
    circle(puck.x+2,puck.y+4,12,'#0008'); circle(puck.x,puck.y,12,'#f4f7fb','#a8b5c0'); circle(puck.x-3,puck.y-3,3,'#fff');
    const remaining = g.serveUntil - (g.serverTime + now - s.received);
    const overlay = document.querySelector('#hockeyOverlay');
    overlay.textContent = g.phase === 'paused' ? 'Oyuncu bekleniyor…' : g.phase === 'finished' ? `${g.names[g.winner] || 'Oyuncu'} kazandı!` : remaining > 0 ? String(Math.ceil(remaining / 1000)) : '';
    overlay.classList.toggle('hidden', !overlay.textContent);
    s.animation = requestAnimationFrame(draw);
  }
  window.watchoutHockey = { render, update, destroy };
})();
