import { secureIndex } from './game-rules.js';

export const HOCKEY = Object.freeze({ width: 480, height: 760, paddle: 28, puck: 12, goal: 180, target: 10, paddleSpeed: 1400, puckSpeed: 1150 });
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function paddle(side) { return { x: 240, y: side === 0 ? 625 : 135, vx: 0, vy: 0, targetX: 240, targetY: side === 0 ? 625 : 135, inputSeq: 0 }; }

export function createHockey(members, initiator) {
  const players = [initiator, ...members.map(m => m.id).filter(id => id !== initiator)].slice(0, 2);
  return { kind: 'hockey', gameId: crypto.randomUUID(), phase: 'lobby', players: [players[0] || null, players[1] || null], names: Object.fromEntries(members.map(m => [m.id, m.nickname])), scores: [0, 0], winner: null, paddles: [paddle(0), paddle(1)], puck: { x: 240, y: 380, vx: 0, vy: 0 }, serveUntil: 0, tick: 0, lastTick: 0 };
}
export function joinHockey(game, id, side, connected, members) {
  if (game.phase !== 'lobby' || ![0, 1].includes(side)) throw new Error('Maç başladı veya taraf geçersiz.');
  const occupant = game.players[side];
  if (occupant && occupant !== id && connected.has(occupant)) throw new Error('Bu taraf dolu.');
  game.players = game.players.map(player => player === id ? null : player);
  game.players[side] = id;
  game.names = Object.fromEntries(members.map(m => [m.id, m.nickname]));
}
function serve(game, toward, now) {
  game.paddles = [paddle(0), paddle(1)];
  const angle = (secureIndex(81) - 40) * Math.PI / 180;
  game.puck = { x: 240, y: 380, vx: Math.sin(angle) * 360, vy: (toward === 0 ? 1 : -1) * Math.cos(angle) * 360 };
  game.serveUntil = now + 1600;
}
export function beginHockey(game, id, connected, now = Date.now()) {
  if (game.phase !== 'lobby' || !game.players.includes(id)) throw new Error('Önce bir taraf seç.');
  if (!game.players.every(player => player && connected.has(player)) || new Set(game.players).size !== 2) throw new Error('İki oyuncu da bağlı olmalı.');
  game.phase = 'playing'; game.lastTick = now;
  serve(game, secureIndex(2), now);
}
export function hockeyPresence(game, connected, now = Date.now()) {
  if (game.phase === 'lobby' || game.phase === 'finished') return;
  if (!game.players.every(id => connected.has(id))) {
    if (game.phase !== 'paused') { game.phase = 'paused'; game.pausedAt = now; }
  } else if (game.phase === 'paused') {
    if (game.serveUntil > game.pausedAt) game.serveUntil += now - game.pausedAt;
    game.serveUntil = Math.max(game.serveUntil, now + 1200);
    game.phase = 'playing'; game.lastTick = now; delete game.pausedAt;
    for (const p of game.paddles) { p.targetX = p.x; p.targetY = p.y; p.vx = p.vy = 0; }
  }
}
export function hockeyInput(game, id, msg) {
  const side = game.players.indexOf(id);
  if (side < 0 || game.phase !== 'playing' || msg.gameId !== game.gameId || !Number.isFinite(msg.x) || !Number.isFinite(msg.y) || !Number.isSafeInteger(msg.seq)) return;
  const p = game.paddles[side];
  if (msg.seq <= p.inputSeq) return;
  p.inputSeq = msg.seq;
  const margin = HOCKEY.paddle + 6;
  p.targetX = clamp(msg.x, margin, HOCKEY.width - margin);
  p.targetY = clamp(msg.y, side === 0 ? 380 + margin : margin, side === 0 ? 760 - margin : 380 - margin);
}
function discCollision(puck, x, y, radius, vx = 0, vy = 0) {
  const dx = puck.x - x, dy = puck.y - y, distance = Math.hypot(dx, dy), separation = HOCKEY.puck + radius;
  if (distance >= separation) return;
  const nx = distance > .001 ? dx / distance : 0, ny = distance > .001 ? dy / distance : (puck.y >= 380 ? -1 : 1);
  puck.x = x + nx * (separation + .05); puck.y = y + ny * (separation + .05);
  const relative = (puck.vx - vx) * nx + (puck.vy - vy) * ny;
  if (relative < 0) { puck.vx -= 1.96 * relative * nx; puck.vy -= 1.96 * relative * ny; }
}
function step(game, dt, now) {
  const { width: w, height: h, puck: r, goal, paddleSpeed, puckSpeed } = HOCKEY;
  const puck = game.puck, left = (w - goal) / 2, right = w - left;
  for (const p of game.paddles) {
    const dx = p.targetX - p.x, dy = p.targetY - p.y, distance = Math.hypot(dx, dy), ratio = distance ? Math.min(1, paddleSpeed * dt / distance) : 0;
    p.vx = dx * ratio / dt; p.vy = dy * ratio / dt; p.x += dx * ratio; p.y += dy * ratio;
  }
  if (now < game.serveUntil) return;
  puck.x += puck.vx * dt; puck.y += puck.vy * dt;
  for (const p of game.paddles) discCollision(puck, p.x, p.y, HOCKEY.paddle, p.vx, p.vy);
  // Rounded posts also stop diagonal shots clipping through the goal edges.
  for (const x of [left, right]) for (const y of [0, h]) discCollision(puck, x, y, 7);
  if (puck.x < r) { puck.x = r; puck.vx = Math.abs(puck.vx) * .995; }
  if (puck.x > w - r) { puck.x = w - r; puck.vx = -Math.abs(puck.vx) * .995; }
  const inGoal = puck.x > left + r && puck.x < right - r;
  if (!inGoal && puck.y < r) { puck.y = r; puck.vy = Math.abs(puck.vy) * .995; }
  if (!inGoal && puck.y > h - r) { puck.y = h - r; puck.vy = -Math.abs(puck.vy) * .995; }
  if (inGoal && (puck.y < -r || puck.y > h + r)) {
    const conceding = puck.y < 0 ? 1 : 0, scorer = 1 - conceding;
    game.scores[scorer]++;
    if (game.scores[scorer] >= HOCKEY.target) { game.phase = 'finished'; game.winner = game.players[scorer]; puck.vx = puck.vy = 0; }
    else serve(game, conceding, now);
    return;
  }
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > puckSpeed) { puck.vx *= puckSpeed / speed; puck.vy *= puckSpeed / speed; }
  // Air cushion: retain momentum, but unstick a nearly stationary puck fairly.
  puck.vx *= Math.exp(-.035 * dt); puck.vy *= Math.exp(-.035 * dt);
  if (speed < 80) { const factor = speed > .01 ? 100 / speed : 0; puck.vx *= factor; puck.vy = speed > .01 ? puck.vy * factor : (secureIndex(2) ? 100 : -100); }
}
export function advanceHockey(game, now = Date.now()) {
  if (game.phase !== 'playing') { game.lastTick = now; return false; }
  // Fixed small steps prevent the disc passing through a fast moving paddle.
  let elapsed = Math.min(.1, Math.max(0, (now - game.lastTick) / 1000));
  game.lastTick = now;
  const score = game.scores[0] + game.scores[1];
  while (elapsed > .000001 && game.phase === 'playing') { const dt = Math.min(elapsed, 1 / 120); step(game, dt, now); elapsed -= dt; }
  game.tick++;
  return game.scores[0] + game.scores[1] !== score;
}
export function hockeyView(game) {
  return { kind: game.kind, gameId: game.gameId, phase: game.phase, players: game.players, names: game.names, scores: game.scores, winner: game.winner, paddles: game.paddles.map(({ x, y, vx, vy, inputSeq }) => ({ x, y, vx, vy, inputSeq })), puck: { ...game.puck }, serveUntil: game.serveUntil, tick: game.tick, serverTime: Date.now(), table: HOCKEY };
}
