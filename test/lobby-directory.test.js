import test from 'node:test';
import assert from 'node:assert/strict';
import { LobbyDirectory } from '../src/lobby-directory.js';
import { roomHarness } from './room-harness.js';

function directory() {
  const data = new Map();
  const value = new LobbyDirectory({ storage: { get: async key => structuredClone(data.get(key)), put: async (key, value) => data.set(key, structuredClone(value)) } });
  const fetch = (url, options) => value.fetch(new Request(url, options));
  const post = body => fetch('https://directory/', { method: 'POST', body: JSON.stringify(body) });
  return { data, fetch, post, binding: { idFromName: name => name, get: () => ({ fetch }) } };
}
test('public directory lists only populated opted-in rooms and excludes secrets', async () => {
  const d = directory();
  await d.post({ code: 'ABCDE', playerCount: 3, visible: true, password: 'secret', members: ['private'], game: 'xox' });
  await d.post({ code: 'FGHJK', playerCount: 4, visible: false });
  await d.post({ code: 'LMNPQ', playerCount: 0, visible: true });
  const response = await d.fetch('https://directory/');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { rooms: [{ code: 'ABCDE', playerCount: 3, full: false, game: 'xox' }] });
  await d.post({ code: 'ABCDE', playerCount: 0, visible: true });
  assert.deepEqual((await (await d.fetch('https://directory/')).json()).rooms, []);
});
test('expired disconnected listings disappear and heartbeat renews expiry', async () => {
  const d = directory();
  await d.post({ code: 'ABCDE', playerCount: 2, visible: true });
  const rooms = d.data.get('rooms'); rooms[0].expiresAt = Date.now() - 1;
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms.length, 0);
  await d.post({ code: 'ABCDE', playerCount: 2, visible: true });
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms.length, 1);
});
test('concurrent directory updates keep all rooms', async () => {
  const d = directory();
  await Promise.all(['ABCDE', 'FGHJK', 'LMNPQ'].map(code => d.post({ code, playerCount: 1, visible: true })));
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms.length, 3);
});
test('room join, authenticated heartbeat, leave and close publish real presence', async () => {
  const d = directory(), h = await roomHarness(2);
  h.room.env = { LOBBIES: d.binding };
  const room = h.state.get('room'); room.code = 'ABCDE'; room.listed = true;
  await h.send(0, { type: 'heartbeat' });
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms[0].playerCount, 2);
  await h.room.onClose(h.sockets[1]);
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms[0].playerCount, 1);
  await h.send(0, { type: 'leave' });
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms.length, 0);
});
test('unjoined socket cannot register or keep a lobby alive', async () => {
  const d = directory(), h = await roomHarness(1);
  h.room.env = { LOBBIES: d.binding };
  const room = h.state.get('room'); room.code = 'ABCDE'; room.listed = true;
  await h.send(h.socket(), { type: 'heartbeat' });
  assert.equal((await (await d.fetch('https://directory/')).json()).rooms.length, 0);
});
