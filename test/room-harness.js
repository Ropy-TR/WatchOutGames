import { Room } from '../src/room.js';
export async function roomHarness(count = 4) {
  const state = new Map([['room', { password: 'test', members: [], game: null }]]);
  let alarmAt = null;
  const room = new Room({ storage: {
    get: async (key) => structuredClone(state.get(key)),
    put: async (key, value) => { await Promise.resolve(); state.set(key, structuredClone(value)); },
    setAlarm: async (at) => { alarmAt = at; }, deleteAlarm: async () => { alarmAt = null; }
  } });
  const sockets = [], ids = [];
  const socket = () => ({ readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); } });
  const send = (n, msg) => room.onMessage(typeof n === 'number' ? sockets[n] : n, JSON.stringify(msg));
  for (let i = 0; i < count; i++) {
    const client = socket(); sockets.push(client);
    await send(client, { type: 'join', password: 'test', nickname: 'Oyuncu ' + i });
    ids.push(client.messages.find((msg) => msg.type === 'joined').playerId);
  }
  return { room, state, sockets, ids, socket, send,
    get game() { return structuredClone(state.get('room').game); },
    get alarmAt() { return alarmAt; },
    setGame(game) { const value = state.get('room'); value.game = structuredClone(game); state.set('room', value); },
    last(n = 0, type = 'game') { return sockets[n].messages.filter((msg) => msg.type === type).at(-1); }
  };
}
export async function codeGame(h) {
  await h.send(0, { type: 'start-codenames' });
  for (let i = 0; i < 4; i++) await h.send(i, { type: 'join-code-team', gameId: h.game.gameId, team: i < 2 ? 'red' : 'blue', role: i % 2 ? 'guesser' : 'master' });
  await h.send(0, { type: 'begin-code', gameId: h.game.gameId });
}
