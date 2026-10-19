import test from 'node:test';
import assert from 'node:assert/strict';
import { roomHarness, codeGame } from './room-harness.js';
import { SPY_CATEGORIES, CODE_WORDS, CITY_LETTERS } from '../src/game-data.js';
import { createSpy, secureIndex, beginCode, createCodeLobby, pickCode, cityScores, cleanAnswers, WIN_LINES, xoxOutcome, expireXox } from '../src/game-rules.js';
import { cellCandidates, createFootballBoard, hasAvailableFootballMove } from '../src/football.js';
import worker from '../src/worker.js';

test('Spyfall has twelve categories with varied, nonduplicate pools and sports', async () => {
  assert.equal(Object.keys(SPY_CATEGORIES).length, 12);
  for (const list of Object.values(SPY_CATEGORIES)) { assert.ok(list.length >= 40); assert.equal(new Set(list).size, list.length); }
  const response = await worker.fetch(new Request('https://test/api/games'), {});
  assert.deepEqual((await response.json()).spyCategories, Object.keys(SPY_CATEGORIES));
  assert.ok(SPY_CATEGORIES['Spor dalları'].includes('Futbol'));
});
test('Spy draw independently admits every member and consecutive repeat spies', () => {
  const members = Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i }));
  for (let spy = 0; spy < 5; spy++) for (let repeat = 0; repeat < 3; repeat++) {
    const draws = [0, spy];
    const game = createSpy(members, 'Ülkeler', repeat, (max) => { const draw = draws.shift(); assert.ok(draw < max); return draw; });
    assert.deepEqual(Object.keys(game.roles).filter((id) => game.roles[id].spy), ['p' + spy]);
    assert.ok(!('location' in game.roles['p' + spy]));
  }
  for (let i = 0; i < 1000; i++) assert.ok(secureIndex(5) < 5);
  for (const max of [0, -1, NaN, 0.5]) assert.throws(() => secureIndex(max));
});
test('Spyfall private roles, shared full candidate list and late spectator', async () => {
  const h = await roomHarness();
  await h.send(0, { type: 'start-spyfall', category: 'Spor dalları' });
  const roleMessages = h.sockets.map((_, i) => h.last(i));
  assert.equal(roleMessages.filter((msg) => msg.role.spy).length, 1);
  for (const msg of roleMessages) {
    assert.deepEqual(msg.game.candidates, SPY_CATEGORIES['Spor dalları']);
    assert.ok(!('roles' in msg.game));
    assert.equal(Object.hasOwn(msg.role, 'location'), !msg.role.spy);
  }
  const late = h.socket(); await h.send(late, { type: 'join', password: 'test', nickname: 'İzleyici' });
  assert.equal(late.messages.at(-1).role, null);
  assert.deepEqual(late.messages.at(-1).game.candidates, SPY_CATEGORIES['Spor dalları']);
});
test('Fair RNG discards the uneven tail before modulo rather than favoring a player', () => {
  const samples = [0xffffffff, 0xfffffffe]; let calls = 0;
  assert.equal(secureIndex(5, (bytes) => { bytes[0] = samples[calls++]; }), 4);
  assert.equal(calls, 2);
  for (let sample = 0; sample < 100; sample++) assert.equal(secureIndex(5, (bytes) => { bytes[0] = sample; }), sample % 5);
});
test('Invalid or inherited category names fall back to a real Spyfall pool', () => {
  const members = ['a','b','c'].map((id) => ({ id }));
  for (const category of ['__proto__', 'constructor', 'toString', 'Olmayan kategori', null]) {
    const game = createSpy(members, category);
    assert.equal(game.category, 'Mekânlar'); assert.equal(game.candidates.length, 60);
    assert.equal(Object.values(game.roles).filter((role) => role.spy).length, 1);
  }
});
test('Spyfall refuses fewer than three active players', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-spyfall' });
  assert.equal(h.game, null); assert.match(h.last(0, 'error').message, /en az 3/);
});
test('Codenames word pool is broad and all random boards are unique', () => {
  assert.ok(CODE_WORDS.length >= 700); assert.equal(new Set(CODE_WORDS).size, CODE_WORDS.length);
  const members = ['rM','rG','bM','bG'].map((id) => ({ id }));
  for (const starting of [0, 1]) {
    const game = createCodeLobby();
    game.assignments = { rM: { team: 'red', role: 'master' }, rG: { team: 'red', role: 'guesser' }, bM: { team: 'blue', role: 'master' }, bG: { team: 'blue', role: 'guesser' } };
    beginCode(game, members, (max) => max === 2 ? starting : 0);
    assert.equal(new Set(game.words).size, 25);
    assert.equal(game.keys.filter((key) => key === game.turn).length, 9);
    assert.equal(game.keys.filter((key) => key === 'assassin').length, 1);
    assert.equal(game.keys.filter((key) => key === 'neutral').length, 7);
    assert.equal(game.targets[game.turn], 9);
  }
});
test('Codenames enforces two masters and guessers, shares identical private maps only with masters', async () => {
  const h = await roomHarness(); await h.send(0, { type: 'start-codenames' });
  await h.send(0, { type: 'begin-code', gameId: h.game.gameId }); assert.equal(h.game.phase, 'lobby');
  await h.send(0, { type: 'join-code-team', gameId: h.game.gameId, team: 'red', role: 'master' });
  await h.send(1, { type: 'join-code-team', gameId: h.game.gameId, team: 'red', role: 'master' });
  assert.ok(!h.game.assignments[h.ids[1]]);
  await codeGame(h);
  assert.equal(h.game.phase, 'playing');
  assert.deepEqual(h.last(0).master, h.last(2).master); assert.equal(h.last(0).master.length, 25);
  for (const n of [1, 3]) { assert.ok(!('master' in h.last(n))); assert.ok(!('keys' in h.last(n).game)); assert.deepEqual(h.last(n).game.colors, {}); }
  await h.send(1, { type: 'join-code-team', gameId: h.game.gameId, team: 'red', role: 'master' });
  assert.equal(h.game.assignments[h.ids[1]].role, 'guesser');
});
test('Codenames clue, correct/neutral/opponent picks, pass and turn guards', async () => {
  const h = await roomHarness(); await codeGame(h);
  const turn = h.game.turn, master = turn === 'red' ? 0 : 2, guesser = master + 1;
  const initial = h.game;
  await h.send(guesser, { type: 'pick-word', index: 0, turnId: initial.turnId }); assert.equal(h.game.revealed.length, 0);
  await h.send(master, { type: 'code-clue', word: 'iki kelime', count: 2, turnId: initial.turnId }); assert.equal(h.game.clue, null);
  await h.send(master, { type: 'code-clue', word: 'bağlantı', count: 2, turnId: initial.turnId }); assert.equal(h.game.guessesLeft, 3);
  await h.send(guesser, { type: 'pass-code', turnId: initial.turnId }); assert.equal(h.game.turnId, initial.turnId);
  const correct = initial.keys.findIndex((key) => key === turn);
  await h.send(master, { type: 'pick-word', index: correct, turnId: initial.turnId }); assert.equal(h.game.revealed.length, 0);
  await h.send(master === 0 ? 3 : 1, { type: 'pick-word', index: correct, turnId: initial.turnId }); assert.equal(h.game.revealed.length, 0);
  await h.send(guesser, { type: 'pick-word', index: correct, turnId: initial.turnId });
  assert.equal(h.game.scores[turn], 1); assert.equal(h.game.guessesLeft, 2); assert.equal(h.last(1).game.colors[correct], turn);
  await h.send(guesser, { type: 'pick-word', index: correct, turnId: initial.turnId }); assert.equal(h.game.revealed.length, 1);
  await h.send(guesser, { type: 'pass-code', turnId: initial.turnId }); assert.notEqual(h.game.turn, turn); assert.equal(h.game.clue, null);
  const next = h.game; const nextMaster = next.turn === 'red' ? 0 : 2;
  await h.send(nextMaster, { type: 'code-clue', word: 'bağlantı', count: 1, turnId: next.turnId });
  const neutral = next.keys.findIndex((key) => key === 'neutral');
  await h.send(nextMaster + 1, { type: 'pick-word', index: neutral, turnId: next.turnId }); assert.equal(h.game.turn, turn);
  const third = h.game;
  await h.send(master, { type: 'code-clue', word: 'bağlantı', count: 1, turnId: third.turnId });
  const other = third.keys.findIndex((key) => key !== turn && ['red', 'blue'].includes(key));
  await h.send(guesser, { type: 'pick-word', index: other, turnId: third.turnId }); assert.notEqual(h.game.turn, turn); assert.equal(h.game.scores[third.keys[other]], 1);
});
test('Codenames extra guess limit ends turn, assassin ends game, ended game rejects clicks', async () => {
  const h = await roomHarness(); await codeGame(h);
  const turn = h.game.turn, master = turn === 'red' ? 0 : 2, guesser = master + 1;
  const turnId = h.game.turnId;
  await h.send(master, { type: 'code-clue', word: 'bağlantı', count: 1, turnId });
  const correct = h.game.keys.flatMap((key, i) => key === turn ? [i] : []);
  for (const index of correct.slice(0, 2)) await h.send(guesser, { type: 'pick-word', index, turnId });
  assert.notEqual(h.game.turnId, turnId);
  const next = h.game, nextMaster = next.turn === 'red' ? 0 : 2;
  await h.send(nextMaster, { type: 'code-clue', word: 'bağlantı', count: 1, turnId: next.turnId });
  await h.send(nextMaster + 1, { type: 'pick-word', index: next.keys.indexOf('assassin'), turnId: next.turnId });
  assert.equal(h.game.winner, turn); assert.equal(h.game.phase, 'finished');
  const length = h.game.revealed.length;
  await h.send(guesser, { type: 'pick-word', index: correct[2], turnId: h.game.turnId }); assert.equal(h.game.revealed.length, length);
});
test('Codenames winner targets correctly follow either starting color, including opponent completing team', () => {
  for (const starting of ['red', 'blue']) for (const team of ['red', 'blue']) {
    const game = { phase: 'playing', turn: team, turnId: 't', assignments: { p: { role: 'guesser', team } }, keys: Array(25).fill(team), revealed: [], scores: { red: 0, blue: 0 }, targets: { [starting]: 9, [starting === 'red' ? 'blue' : 'red']: 8 }, clue: { word: 'test', count: 9 }, guessesLeft: 10, guessesMade: 0 };
    for (let i = 0; i < game.targets[team]; i++) pickCode(game, 'p', i, 't');
    assert.equal(game.winner, team); assert.equal(game.scores[team], game.targets[team]);
  }
});
test('İsim Şehir Turkish letters and duplicate / invalid scoring', () => {
  assert.ok(CITY_LETTERS.includes('Ç') && CITY_LETTERS.includes('Ş') && CITY_LETTERS.includes('Ü') && CITY_LETTERS.includes('I') && CITY_LETTERS.includes('İ'));
  const game = { letter: 'İ', categories: ['İsim','Şehir','Hayvan'], invalid: {}, submissions: { a: { İsim: 'İpek', Şehir: 'izmir', Hayvan: 'İguana' }, b: { İsim: 'İlker', Şehir: ' İZMİR ', Hayvan: 'inek' }, c: { İsim: 'Ali', Şehir: 'Isparta', Hayvan: '' } } };
  const scores = cityScores(game);
  assert.equal(scores.a.cells.Şehir, 5); assert.equal(scores.b.cells.Şehir, 5);
  assert.equal(scores.a.cells.İsim, 10); assert.equal(scores.c.total, 0);
  game.invalid.a = { Şehir: true }; assert.equal(cityScores(game).a.cells.Şehir, 0); assert.equal(cityScores(game).b.cells.Şehir, 10);
  assert.equal(cleanAnswers({ İsim: 'a'.repeat(100) }).İsim.length, 48);
});
test('İsim Şehir keeps answers private, keyed by ID, locks submission and finishes all-submitted', async () => {
  const h = await roomHarness(3); await h.send(0, { type: 'start-city' });
  const gameId = h.game.gameId;
  await h.send(0, { type: 'save-city', gameId, answers: { İsim: 'Gizli' } });
  assert.ok(!('submissions' in h.room.publicGame(h.game))); assert.ok(!JSON.stringify(h.last(1)).includes('Gizli'));
  await h.send(0, { type: 'submit-city', gameId, answers: { İsim: 'İlk' } });
  assert.equal(h.last(0).mine.İsim, 'İlk'); assert.ok(!('submissions' in h.last(1).game));
  await h.send(0, { type: 'submit-city', gameId, answers: { İsim: 'Değişik' } }); assert.equal(h.game.submissions[h.ids[0]].İsim, 'İlk');
  for (const n of [1, 2]) await h.send(n, { type: 'submit-city', gameId, answers: { İsim: 'Test' } });
  assert.equal(h.game.phase, 'results'); assert.equal(Object.keys(h.last(1).game.submissions).length, 3); assert.equal(h.alarmAt, null);
  await h.send(0, { type: 'review-city', gameId, targetId: h.ids[1], category: 'İsim', invalid: true }); assert.equal(h.last().game.scores[h.ids[1]].cells.İsim, 0);
});
test('İsim Şehir timeout finalizes saved drafts and refuses late or stale answers', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-city' });
  const gameId = h.game.gameId;
  await h.send(0, { type: 'save-city', gameId, answers: { İsim: 'Taslak' } });
  const game = h.game; game.startedAt -= 91000; h.setGame(game);
  await h.room.alarm(); assert.equal(h.game.phase, 'results'); assert.equal(h.game.submissions[h.ids[0]].İsim, 'Taslak'); assert.ok(h.game.submissions[h.ids[1]]);
  await h.send(1, { type: 'submit-city', gameId, answers: { İsim: 'Geç cevap' } }); assert.equal(h.game.submissions[h.ids[1]].İsim, '');
  await h.send(0, { type: 'next-city', gameId });
  await h.send(0, { type: 'submit-city', gameId, answers: { İsim: 'Eski tur' } }); assert.deepEqual(h.game.submissions, {});
});
test('XOX all eight lines and draw recognized; mixed lines are not wins', () => {
  for (const team of ['X','O']) for (const line of WIN_LINES) assert.deepEqual(xoxOutcome(Object.fromEntries(line.map((key) => [key, team]))), { winner: team, winningLine: line });
  assert.equal(xoxOutcome({ '0-0': 'X', '0-1': 'O', '0-2': 'X' }), null);
  const draw = ['X','O','X','X','O','O','O','X','X'];
  assert.equal(xoxOutcome(Object.fromEntries(draw.map((team, i) => [Math.floor(i / 3) + '-' + i % 3, team]))).winner, 'draw');
});
test('XOX can distinguish a legal remaining answer from a blocked last cell', () => {
  const game = createFootballBoard({ mode: 'countries' }, (max) => Math.floor(Math.random() * max));
  assert.equal(hasAvailableFootballMove(game), true);
  for (let n = 1; n < 9; n++) game.picks[Math.floor(n / 3) + '-' + n % 3] = 'occupied';
  const candidates = cellCandidates(game, 0, 0);
  game.playerPicks = Object.fromEntries(candidates.map((id, i) => [i, id]));
  assert.equal(hasAvailableFootballMove(game), false);
  delete game.playerPicks[0]; assert.equal(hasAvailableFootballMove(game), true);
});
test('XOX assigns all five players to teams, enforces turns, 30s and stale turn guard', async () => {
  const h = await roomHarness(5); await h.send(0, { type: 'start-xox', mode: 'countries' });
  const game = h.game;
  assert.equal(game.teams.X.length, 3); assert.equal(game.teams.O.length, 2);
  assert.ok(game.deadline - Date.now() > 29000 && game.deadline - Date.now() <= 30000);
  assert.equal(h.alarmAt, game.deadline);
  const right = h.ids.indexOf(game.teams[game.turn][0]); const wrong = h.ids.indexOf(game.teams[game.turn === 'X' ? 'O' : 'X'][0]);
  const pick = { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key: '0-0', playerId: cellCandidates(game, 0, 0)[0] };
  await h.send(wrong, pick); assert.deepEqual(h.game.picks, {});
  await h.send(right, pick); assert.equal(h.game.owners['0-0'], game.turn); assert.notEqual(h.game.turn, game.turn);
  const before = h.game; await h.send(right, { ...pick, key: '0-1' }); assert.deepEqual(h.game, before);
});
test('XOX wrong answers, pass, expiration and delayed alarms advance exactly once', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-xox' });
  let game = h.game; const first = h.ids.indexOf(game.teams[game.turn][0]);
  await h.send(first, { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key: '0-0', playerId: 'Q1' });
  assert.deepEqual(h.game.picks, {}); assert.notEqual(h.game.turn, game.turn);
  game = h.game; const second = h.ids.indexOf(game.teams[game.turn][0]);
  await h.send(second, { type: 'pass-xox', boardId: game.boardId, turnId: game.turnId }); assert.notEqual(h.game.turn, game.turn);
  game = h.game; game.deadline = Date.now() - 1; h.setGame(game);
  await h.room.alarm(); const after = h.game; assert.notEqual(after.turn, game.turn); assert.ok(after.deadline > Date.now());
  await h.room.alarm(); assert.equal(h.game.turnId, after.turnId);
  const delayed = { turn: 'X', turnId: 'old', deadline: 1000 };
  expireXox(delayed, 91001); assert.equal(delayed.turn, 'X'); assert.equal(delayed.deadline, 121000);
});
test('XOX valid line ends game and refuses every further move', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-xox', mode: 'countries' });
  const starting = h.game.turn;
  for (const key of ['0-0','0-1','0-2']) {
    let game = h.game;
    if (game.turn !== starting) { await h.send(h.ids.indexOf(game.teams[game.turn][0]), { type: 'pass-xox', boardId: game.boardId, turnId: game.turnId }); game = h.game; }
    const [r,c] = key.split('-').map(Number); const playerId = cellCandidates(game, r, c).find((id) => !Object.values(game.playerPicks).includes(id));
    assert.ok(playerId); await h.send(h.ids.indexOf(game.teams[game.turn][0]), { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key, playerId });
  }
  assert.equal(h.game.winner, starting); assert.deepEqual(h.game.winningLine, ['0-0','0-1','0-2']); assert.equal(h.alarmAt, null);
  const before = h.game; await h.send(0, { type: 'pass-xox', boardId: before.boardId, turnId: before.turnId }); assert.deepEqual(h.game, before);
});
test('Concurrent socket writes never lose submitted answers or accept two XOX moves in one turn', async () => {
  const h = await roomHarness(4); await h.send(0, { type: 'start-city' }); const gameId = h.game.gameId;
  await Promise.all(h.ids.map((_, n) => h.send(n, { type: 'submit-city', gameId, answers: { İsim: 'Kişi ' + n } })));
  assert.equal(Object.keys(h.game.submissions).length, 4); assert.equal(h.game.phase, 'results');
  await h.send(0, { type: 'start-xox' }); const game = h.game;
  await Promise.all(game.teams[game.turn].map((id, n) => h.send(h.ids.indexOf(id), { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key: '0-' + n, playerId: cellCandidates(game, 0, n)[0] })));
  assert.equal(Object.keys(h.game.picks).length, 1);
});
test('Reconnect preserves roles using private token; public IDs alone cannot steal identity', async () => {
  const h = await roomHarness(3); await h.send(0, { type: 'start-spyfall' });
  const joined = h.last(0, 'joined'); const role = h.last(0).role;
  assert.ok(!JSON.stringify(h.room.publicRoom(h.state.get('room'))).includes(joined.sessionToken));
  await h.room.onClose(h.sockets[0]); assert.equal(h.state.get('room').members.find((m) => m.id === joined.playerId).online, false);
  const reload = h.socket(); await h.send(reload, { type: 'join', password: 'test', nickname: 'Geri döndüm', playerId: joined.playerId, sessionToken: joined.sessionToken });
  assert.deepEqual(reload.messages.at(-1).role, role);
  const attacker = h.socket(); await h.send(attacker, { type: 'join', password: 'test', nickname: 'Başka', playerId: joined.playerId });
  assert.notEqual(attacker.messages.find((msg) => msg.type === 'joined').playerId, joined.playerId); assert.equal(attacker.messages.at(-1).role, null);
});
test('Empty XOX room cancels repeating alarms and reconnect schedules the next deadline', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-xox' });
  const session = h.last(0, 'joined');
  for (const client of h.sockets) await h.room.onClose(client);
  assert.equal(h.alarmAt, null);
  const socket = h.socket(); await h.send(socket, { type: 'join', password: 'test', nickname: 'Geri', playerId: session.playerId, sessionToken: session.sessionToken });
  assert.ok(h.alarmAt > Date.now());
});
test('Legacy rooms reset incompatible games without losing the room password', async () => {
  const h = await roomHarness(2);
  for (const game of [{ kind: 'codenames', keys: [] }, { kind: 'city', submissions: {} }, { kind: 'spyfall', roles: {} }, { kind: 'xox', picks: {} }]) {
    h.setGame(game); const fresh = await h.room.loadRoom();
    assert.equal(fresh.game, null); assert.equal(fresh.password, 'test');
  }
});
