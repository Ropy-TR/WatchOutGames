import { secureIndex } from './game-rules.js';
import { duelSeats, requireDuelPlayers } from './duel-lobby.js';
export const FLEET = [5, 4, 3, 3, 2];
const SIZE = 10;
const around = (a, b) => Math.abs(a % SIZE - b % SIZE) <= 1 && Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) <= 1;
export function validateFleet(fleet, partial = false) {
  if (!Array.isArray(fleet) || fleet.length > FLEET.length || (!partial && fleet.length !== FLEET.length)) throw new Error('Filo: 5, 4, 3, 3 ve 2 karelik beş gemi olmalı.');
  const occupied = [];
  for (let index = 0; index < fleet.length; index++) {
    const ship = fleet[index];
    if (!Array.isArray(ship) || ship.length !== FLEET[index] || ship.some(cell => !Number.isInteger(cell) || cell < 0 || cell >= 100) || new Set(ship).size !== ship.length) throw new Error('Gemi boyu veya konumu geçersiz.');
    const sorted = [...ship].sort((a, b) => a - b);
    const horizontal = sorted.every(cell => Math.floor(cell / SIZE) === Math.floor(sorted[0] / SIZE)) && sorted.every((cell, n) => cell === sorted[0] + n);
    const vertical = sorted.every((cell, n) => cell === sorted[0] + n * SIZE);
    if ((!horizontal && !vertical) || occupied.some(cell => ship.some(next => around(cell, next)))) throw new Error('Gemiler düz olmalı; birbirine çapraz dahil değmemeli.');
    occupied.push(...ship);
  }
  return fleet.map(ship => [...ship].sort((a, b) => a - b));
}
export function randomFleet() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const fleet = [];
    for (const size of FLEET) {
      const choices = [];
      for (let start = 0; start < 100; start++) for (const step of [1, 10]) {
        const ship = Array.from({ length: size }, (_, n) => start + step * n);
        try { validateFleet([...fleet, ship], true); choices.push(ship); } catch {}
      }
      if (!choices.length) break;
      fleet.push(choices[secureIndex(choices.length)]);
    }
    if (fleet.length === FLEET.length) return fleet;
  }
  throw new Error('Filo yerleştirilemedi; tekrar dene.');
}
export function createBattleship(members, initiator) {
  return { kind: 'battleship', gameId: crypto.randomUUID(), phase: 'lobby', ...duelSeats(members, initiator), fleets: {}, ready: [], shots: {}, timeouts: {}, turn: null, turnId: null, deadline: null, winner: null, lastShot: null };
}
export function beginBattleship(game, id, connected) {
  requireDuelPlayers(game, id, connected);
  game.phase = 'preparing';
  for (const player of game.players) { game.shots[player] = []; game.timeouts[player] = 0; game.fleets[player] = []; }
}
export function setFleet(game, id, fleet, ready) {
  if (game.phase !== 'preparing' || !game.players.includes(id) || game.ready.includes(id)) throw new Error('Bu filo artık değiştirilemez.');
  game.fleets[id] = validateFleet(fleet, !ready);
  if (ready) game.ready.push(id);
  if (game.ready.length === 2) {
    game.phase = 'playing'; game.turn = game.players[secureIndex(2)]; nextTurn(game, Date.now());
  }
}
function nextTurn(game, now) { game.turnId = crypto.randomUUID(); game.deadline = now + 30000; }
export function shootBattleship(game, id, msg, now = Date.now()) {
  if (game.phase !== 'playing' || game.turn !== id || msg.turnId !== game.turnId || now >= game.deadline) throw new Error('Sıra değişti veya sıra sende değil.');
  if (!Number.isInteger(msg.cell) || msg.cell < 0 || msg.cell >= 100 || game.shots[id].some(shot => shot.cell === msg.cell)) throw new Error('Bu kareye atış yapılamaz.');
  const enemy = game.players.find(player => player !== id), fleet = game.fleets[enemy];
  const ship = fleet.find(ship => ship.includes(msg.cell));
  const shot = { cell: msg.cell, hit: Boolean(ship) }; game.shots[id].push(shot);
  if (ship && ship.every(cell => game.shots[id].some(shot => shot.cell === cell))) shot.sunk = [...ship];
  game.lastShot = { player: id, ...shot }; game.timeouts[id] = 0;
  if (fleet.flat().every(cell => game.shots[id].some(shot => shot.cell === cell))) { game.phase = 'results'; game.winner = id; game.deadline = null; game.turn = null; }
  else { game.turn = enemy; nextTurn(game, now); }
}
export function expireBattleship(game, now = Date.now()) {
  if (game.phase !== 'playing' || now < game.deadline) return false;
  const id = game.turn, enemy = game.players.find(player => player !== id);
  game.timeouts[id]++; game.lastShot = { player: id, timeout: true };
  if (game.timeouts[id] >= 3) { game.phase = 'results'; game.winner = enemy; game.reason = 'timeout'; game.turn = null; game.deadline = null; }
  else { game.turn = enemy; nextTurn(game, now); }
  return true;
}
export function battleshipPresence(game, connected, now = Date.now()) {
  if (game.phase === 'playing' && !game.players.every(id => connected.has(id))) { game.remaining = Math.max(1000, game.deadline - now); game.phase = 'paused'; game.deadline = null; }
  else if (game.phase === 'paused' && game.players.every(id => connected.has(id))) { game.phase = 'playing'; game.deadline = now + game.remaining; delete game.remaining; }
}
export function battleshipView(game) {
  return { kind: game.kind, gameId: game.gameId, phase: game.phase, players: game.players, names: game.names, ready: game.ready, shots: game.shots, turn: game.turn, turnId: game.turnId, deadline: game.deadline, serverTime: Date.now(), winner: game.winner, reason: game.reason, lastShot: game.lastShot, timeouts: game.timeouts, fleetSizes: FLEET, ...(game.phase === 'results' ? { fleets: game.fleets } : {}) };
}
export function battleshipPrivate(game, id) { return game.players.includes(id) ? { fleet: game.fleets[id] || [] } : null; }
