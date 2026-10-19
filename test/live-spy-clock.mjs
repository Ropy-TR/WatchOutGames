// Real WebSockets + the 30-second last-guess Durable Object alarm.
import assert from 'node:assert/strict';
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const response = await fetch(base + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'spy-clock' }) });
const { code } = await response.json();
const clients = [];
async function until(check, timeout = 10000) {
  const end = Date.now() + timeout;
  do { if (check()) return; await new Promise((resolve) => setTimeout(resolve, 40)); } while (Date.now() < end);
  throw new Error('Spy clock check timed out');
}
try {
  for (let n = 0; n < 3; n++) {
    const client = { socket: new WebSocket(base.replace('http', 'ws') + '/api/rooms/' + code + '/socket') };
    clients.push(client);
    client.send = (msg) => client.socket.send(JSON.stringify(msg));
    client.socket.addEventListener('message', (event) => { const msg = JSON.parse(event.data); if (msg.type === 'joined') client.id = msg.playerId; if (msg.type === 'game') { client.game = msg.game; client.role = msg.role; } });
    await new Promise((resolve) => client.socket.addEventListener('open', resolve, { once: true }));
    client.send({ type: 'join', password: 'spy-clock', nickname: 'Spy clock ' + n });
    await until(() => client.id);
  }
  clients[0].send({ type: 'start-spyfall', category: 'Ülkeler' });
  await until(() => clients.every((client) => client.game?.kind === 'spyfall'));
  const spy = clients.find((client) => client.role.spy);
  const gameId = spy.game.gameId;
  clients[0].send({ type: 'start-spy-vote', gameId });
  await until(() => clients.every((client) => client.game.phase === 'voting'));
  const voteId = clients[0].game.vote.id;
  for (const client of clients.slice(0, 2)) client.send({ type: 'vote-spy', gameId, voteId, targetId: spy.id });
  await until(() => clients.every((client) => client.game.phase === 'guessing'));
  assert.ok(clients.every((client) => client.game.guess.mode === 'caught'));
  console.log('PASS: real majority vote exposes only spy identity and opens last guess');
  console.log('Waiting for real 30-second last-guess deadline...');
  await until(() => clients.every((client) => client.game.phase === 'results'), 35000);
  for (const client of clients) assert.equal(spy.game.match.scores[client.id], client === spy ? 0 : 2);
  assert.equal(spy.game.result.reason, 'guess-timeout');
  console.log('PASS: last-guess alarm ends round and awards each innocent exactly 2 points');
} finally { for (const client of clients) client.socket.close(); }
