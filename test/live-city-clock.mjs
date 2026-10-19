// Integration check using the real 90-second Durable Object alarm, no fake clock.
import assert from 'node:assert/strict';
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const created = await fetch(base + '/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'clock' }) });
const { code } = await created.json();
const clients = [];
async function until(check, timeout = 10000) {
  const end = Date.now() + timeout;
  do { if (check()) return; await new Promise((resolve) => setTimeout(resolve, 50)); } while (Date.now() < end);
  throw new Error('Live city clock timed out');
}
async function join(n, session = {}) {
  const client = { socket: new WebSocket(base.replace('http', 'ws') + '/api/rooms/' + code + '/socket'), messages: [], game: null };
  clients.push(client);
  client.send = (msg) => client.socket.send(JSON.stringify(msg));
  client.socket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data); client.messages.push(msg);
    if (msg.type === 'game') { client.game = msg.game; client.mine = msg.mine; }
    if (msg.type === 'joined') client.session = { playerId: msg.playerId, sessionToken: msg.sessionToken };
  });
  await new Promise((resolve) => client.socket.addEventListener('open', resolve, { once: true }));
  client.send({ type: 'join', password: 'clock', nickname: 'Clock ' + n, ...session });
  await until(() => client.session);
  return client;
}
try {
  const a = await join(0), b = await join(1), c = await join(2);
  a.send({ type: 'start-city' }); await until(() => a.game?.kind === 'city' && b.game?.kind === 'city');
  const { gameId, letter } = a.game;
  a.send({ type: 'save-city', gameId, answers: { İsim: letter + ' taslak' } });
  b.send({ type: 'submit-city', gameId, answers: { İsim: letter + ' gönderildi' } });
  await until(() => a.game.submittedIds.length === 1);
  assert.equal(a.mine.İsim, letter + ' taslak');
  assert.ok(!JSON.stringify(b.game).includes('taslak'));
  a.socket.close(); const reloaded = await join(0, a.session);
  await until(() => reloaded.game?.gameId === gameId);
  assert.equal(reloaded.mine.İsim, letter + ' taslak');
  assert.equal(reloaded.session.playerId, a.session.playerId);
  console.log('PASS: saved city draft survives a real socket reconnect; other players cannot read it');
  console.log('Waiting for real 90-second city deadline...');
  await until(() => reloaded.game.phase === 'results' && c.game?.phase === 'results', 95000);
  assert.equal(reloaded.game.submissions[a.session.playerId].İsim, letter + ' taslak');
  assert.equal(reloaded.game.submissions[c.session.playerId].İsim, '');
  const before = c.messages.length;
  c.send({ type: 'submit-city', gameId, answers: { İsim: letter + ' geç' } });
  await until(() => c.messages.slice(before).some((msg) => msg.type === 'error'));
  assert.equal(c.game.submissions[c.session.playerId].İsim, '');
  console.log('PASS: actual 90-second alarm reveals results, includes unsubmitted drafts, rejects late answers');
} finally { for (const client of clients) client.socket.close(); }
