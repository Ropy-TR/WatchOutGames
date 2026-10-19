import test from 'node:test';
import assert from 'node:assert/strict';
import { roomHarness } from './room-harness.js';
import { spyId, spyLocation, cityMatchView, createXoxSeries, recordXoxResult } from '../src/match-rules.js';
import { cellCandidates } from '../src/football.js';

async function spyGame(count = 4) { const h = await roomHarness(count); await h.send(0, { type: 'start-spyfall', category: 'Ülkeler' }); return h; }
const spyIndex = (h) => h.ids.indexOf(spyId(h.game));
async function voteFor(h, targetId) {
  await h.send(0, { type: 'start-spy-vote', gameId: h.game.gameId });
  const { gameId, vote } = h.game;
  for (let i = 0; i < h.ids.length && h.game.phase === 'voting'; i++) await h.send(i, { type: 'vote-spy', gameId, voteId: vote.id, targetId });
}
async function guess(h, correct) {
  const game = h.game;
  const location = correct ? spyLocation(game) : game.candidates.find((candidate) => candidate !== spyLocation(game));
  await h.send(spyIndex(h), { type: 'guess-spy', gameId: game.gameId, location });
}
test('Wrong majority accusation gives exactly 2 points to the spy and reveals round result', async () => {
  const h = await spyGame(); const spy = spyId(h.game), innocent = h.ids.find((id) => id !== spy);
  await voteFor(h, innocent);
  assert.equal(h.game.phase, 'results'); assert.equal(h.game.result.reason, 'wrong-vote');
  assert.equal(h.game.match.scores[spy], 2);
  for (const id of h.ids.filter((id) => id !== spy)) assert.equal(h.game.match.scores[id], 0);
  assert.equal(h.last().game.result.location, spyLocation(h.game)); assert.equal(h.alarmAt, null);
});
test('Voting uses strict majority, one immutable vote per participant and rejects stale vote IDs', async () => {
  const h = await spyGame(); const targetId = h.ids.find((id) => id !== spyId(h.game)); const { gameId } = h.game;
  await h.send(0, { type: 'start-spy-vote', gameId }); const voteId = h.game.vote.id;
  await h.send(0, { type: 'vote-spy', gameId, voteId: 'old', targetId }); assert.deepEqual(h.game.vote.ballots, {});
  await h.send(0, { type: 'vote-spy', gameId, voteId, targetId });
  await h.send(0, { type: 'vote-spy', gameId, voteId, targetId: spyId(h.game) }); assert.equal(h.game.vote.ballots[h.ids[0]], targetId);
  await h.send(1, { type: 'vote-spy', gameId, voteId, targetId }); assert.equal(h.game.phase, 'voting');
  assert.equal(h.last().game.vote.counts[targetId], 2); assert.ok(!('ballots' in h.last().game.vote));
  await h.send(2, { type: 'vote-spy', gameId, voteId, targetId }); assert.equal(h.game.phase, 'results');
});
test('Tie returns to the round with no points; expired round without majority awards spy 2', async () => {
  const h = await spyGame(); await h.send(0, { type: 'start-spy-vote', gameId: h.game.gameId });
  const { gameId, vote } = h.game;
  for (let i = 0; i < 4; i++) await h.send(i, { type: 'vote-spy', gameId, voteId: vote.id, targetId: h.ids[i % 2] });
  assert.equal(h.game.phase, 'playing'); assert.ok(Object.values(h.game.match.scores).every((score) => score === 0));
  let game = h.game; game.startedAt -= 481000; h.setGame(game); await h.room.alarm();
  assert.equal(h.game.phase, 'voting');
  game = h.game; game.vote.deadline = Date.now() - 1; h.setGame(game); await h.room.alarm();
  assert.equal(h.game.phase, 'results'); assert.equal(h.game.match.scores[spyId(h.game)], 2);
});
test('Spy voluntary correct guess awards 2; wrong guess gives each innocent 2', async () => {
  for (const correct of [true, false]) {
    const h = await spyGame(); const spy = spyId(h.game);
    await h.send(spyIndex(h), { type: 'start-spy-guess', gameId: h.game.gameId });
    assert.equal(h.game.phase, 'guessing'); assert.equal(h.game.guess.mode, 'voluntary');
    await guess(h, correct);
    for (const id of h.ids) assert.equal(h.game.match.scores[id], correct ? (id === spy ? 2 : 0) : (id === spy ? 0 : 2));
  }
});
test('Caught spy retains one final guess: success awards 1, failure awards each innocent 2', async () => {
  for (const correct of [true, false]) {
    const h = await spyGame(); const spy = spyId(h.game), location = spyLocation(h.game);
    await voteFor(h, spy);
    assert.equal(h.game.phase, 'guessing'); assert.equal(h.game.guess.mode, 'caught');
    const publicGame = h.last().game; assert.equal(publicGame.guess.spyId, spy); assert.ok(!('result' in JSON.parse(JSON.stringify(publicGame))));
    assert.ok(!('location' in publicGame));
    await guess(h, correct);
    assert.equal(h.game.phase, 'results'); assert.equal(h.game.result.location, location);
    for (const id of h.ids) assert.equal(h.game.match.scores[id], correct ? (id === spy ? 1 : 0) : (id === spy ? 0 : 2));
  }
});
test('Only the spy can guess; spectators cannot vote; duplicate results cannot award points twice', async () => {
  const h = await spyGame(); const spy = spyIndex(h), innocent = (spy + 1) % 4; const { gameId } = h.game;
  await h.send(innocent, { type: 'start-spy-guess', gameId }); assert.equal(h.game.phase, 'playing');
  const late = h.socket(); await h.send(late, { type: 'join', nickname: 'Late', password: 'test' });
  await h.send(late, { type: 'start-spy-vote', gameId }); assert.equal(h.game.phase, 'playing');
  await h.send(spy, { type: 'start-spy-guess', gameId });
  await h.send(innocent, { type: 'guess-spy', gameId, location: spyLocation(h.game) }); assert.equal(h.game.phase, 'guessing');
  await guess(h, true); const before = h.game.match.scores;
  await guess(h, true); assert.deepEqual(h.game.match.scores, before);
  await h.send(0, { type: 'start-spyfall', category: 'Ülkeler' }); assert.deepEqual(h.game.match.scores, before);
});
test('Spy guess timeout awards innocent points, alarm is idempotent', async () => {
  const h = await spyGame(); await voteFor(h, spyId(h.game));
  const game = h.game; game.guess.deadline = Date.now() - 1; h.setGame(game); await h.room.alarm();
  assert.equal(h.game.result.reason, 'guess-timeout'); const scores = h.game.match.scores;
  await h.room.alarm(); assert.deepEqual(h.game.match.scores, scores);
});
test('Spy score persists across rounds, round result cannot be skipped and reaching 10 finishes match', async () => {
  const h = await spyGame(); const original = h.game;
  await h.send(0, { type: 'next-spy', gameId: original.gameId }); assert.equal(h.game.gameId, original.gameId);
  await voteFor(h, h.ids.find((id) => id !== spyId(h.game)));
  const scores = h.game.match.scores;
  await h.send(0, { type: 'next-spy', gameId: h.game.gameId }); assert.equal(h.game.round, 2); assert.deepEqual(h.game.match.scores, scores);
  const game = h.game, spy = spyId(game); game.match.scores[spy] = 8; h.setGame(game);
  await h.send(spyIndex(h), { type: 'start-spy-guess', gameId: game.gameId }); await guess(h, true);
  assert.equal(h.game.match.scores[spy], 10); assert.equal(h.game.match.finished, true); assert.ok(h.game.match.winners.includes(spy));
  const endId = h.game.gameId; await h.send(0, { type: 'next-spy', gameId: endId }); assert.equal(h.game.gameId, endId);
  await h.send(0, { type: 'start-spyfall', gameId: endId, restart: true, category: 'Ülkeler' }); assert.equal(h.game.round, 1); assert.ok(Object.values(h.game.match.scores).every((score) => score === 0));
});
test('Concurrent majority votes award the round once and next-round packets cannot double advance', async () => {
  const h = await spyGame(); await h.send(0, { type: 'start-spy-vote', gameId: h.game.gameId });
  const { gameId, vote } = h.game, targetId = h.ids.find((id) => id !== spyId(h.game));
  await Promise.all(h.ids.map((_, i) => h.send(i, { type: 'vote-spy', gameId, voteId: vote.id, targetId })));
  assert.equal(h.game.match.scores[spyId(h.game)], 2);
  await Promise.all([h.send(0, { type: 'next-spy', gameId }), h.send(1, { type: 'next-spy', gameId })]); assert.equal(h.game.round, 2);
});

test('İsim Şehir plays exactly five rounds, accumulates reviewed scores and reports tied winners', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-city' }); const matchId = h.game.match.id; const letters = [];
  for (let round = 1; round <= 5; round++) {
    const { gameId, letter } = h.game; letters.push(letter);
    assert.equal(h.game.match.round, round); assert.equal(h.game.match.id, matchId);
    for (let n = 0; n < 2; n++) await h.send(n, { type: 'submit-city', gameId, answers: { İsim: letter + ' kişi ' + n } });
    assert.equal(h.last().game.match.totals[h.ids[0]], round * 10);
    if (round < 5) await h.send(0, { type: 'next-city', gameId });
  }
  assert.equal(new Set(letters).size, 5); assert.equal(h.last().game.match.finished, true); assert.deepEqual(h.last().game.match.winners.sort(), [...h.ids].sort());
  const gameId = h.game.gameId; await h.send(0, { type: 'next-city', gameId }); assert.equal(h.game.gameId, gameId);
  await h.send(0, { type: 'start-city', gameId, restart: true }); assert.equal(h.game.match.round, 1); assert.equal(h.last().game.match.totals[h.ids[0]], 0);
});
test('City reviews affect current total once and carry forward without duplicate round points', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-city' }); const { gameId, letter } = h.game;
  for (let i = 0; i < 2; i++) await h.send(i, { type: 'submit-city', gameId, answers: { İsim: letter + ' aynı' } });
  assert.equal(h.last().game.match.totals[h.ids[0]], 5);
  await h.send(0, { type: 'review-city', gameId, targetId: h.ids[1], category: 'İsim', invalid: true });
  assert.equal(h.last().game.match.totals[h.ids[0]], 10); assert.equal(h.last().game.match.totals[h.ids[1]], 0);
  const before = h.game; await h.send(0, { type: 'start-city' }); assert.equal(h.game.gameId, before.gameId);
  await Promise.all([h.send(0, { type: 'next-city', gameId }), h.send(1, { type: 'next-city', gameId })]);
  assert.equal(h.game.match.round, 2); assert.equal(h.last().game.match.totals[h.ids[0]], 10);
  await h.send(0, { type: 'review-city', gameId, targetId: h.ids[1], category: 'İsim', invalid: false }); assert.equal(h.last().game.match.totals[h.ids[0]], 10);
});

function solveCells(game) {
  const cells = Array.from({ length: 9 }, (_, n) => ({ key: Math.floor(n / 3) + '-' + n % 3, candidates: cellCandidates(game, Math.floor(n / 3), n % 3) })).sort((a, b) => a.candidates.length - b.candidates.length);
  const used = new Set(), answer = {};
  function visit(n) {
    if (n === 9) return true;
    for (const id of cells[n].candidates) {
      if (used.has(id)) continue; used.add(id); answer[cells[n].key] = id;
      if (visit(n + 1)) return true; used.delete(id);
    }
    return false;
  }
  assert.ok(visit(0)); return answer;
}
async function xoxWin(h, team) {
  const answers = solveCells(h.game);
  for (const key of ['0-0','0-1','0-2']) {
    let game = h.game;
    if (game.turn !== team) { await h.send(h.ids.indexOf(game.teams[game.turn][0]), { type: 'pass-xox', boardId: game.boardId, turnId: game.turnId }); game = h.game; }
    await h.send(h.ids.indexOf(game.teams[team][0]), { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key, playerId: answers[key] });
  }
  assert.equal(h.game.winner, team);
}
test('XOX best of three keeps teams, tracks a 1–1 tie, ends at 2 wins and rejects a fourth decisive game', async () => {
  const h = await roomHarness(4); await h.send(0, { type: 'start-xox' }); const teams = h.game.teams;
  for (const [index, team] of ['X','O','X'].entries()) {
    await xoxWin(h, team); const game = h.game;
    assert.equal(game.series.scores.X, index === 2 ? 2 : 1); assert.equal(game.series.scores.O, index === 0 ? 0 : 1);
    if (index < 2) { await h.send(0, { type: 'next-xox', boardId: game.boardId }); assert.deepEqual(h.game.teams, teams); }
  }
  assert.equal(h.game.series.finished, true); assert.equal(h.game.series.winner, 'X'); assert.equal(h.alarmAt, null);
  const boardId = h.game.boardId; await h.send(0, { type: 'next-xox', boardId }); assert.equal(h.game.boardId, boardId);
  await h.send(0, { type: 'start-xox', boardId, restart: true }); assert.deepEqual(h.game.series.scores, { X: 0, O: 0 });
});
test('XOX sweep ends series 2–0 and a repeated result never increments score again', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-xox' });
  await xoxWin(h, 'O'); const game = h.game;
  recordXoxResult(game); assert.deepEqual(game.series.scores, { X: 0, O: 1 });
  await h.send(0, { type: 'start-xox' }); assert.equal(h.game.boardId, game.boardId);
  await h.send(0, { type: 'next-xox', boardId: game.boardId }); await xoxWin(h, 'O');
  assert.deepEqual(h.game.series.scores, { X: 0, O: 2 }); assert.equal(h.game.series.finished, true);
});
test('XOX drawn board preserves series score and may be replayed with the same teams', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-xox' }); const game = h.game, answers = solveCells(game);
  const owners = ['X','O','X','X','O','O','O','X'];
  for (let n = 0; n < 8; n++) { const key = Math.floor(n / 3) + '-' + n % 3; game.owners[key] = owners[n]; game.picks[key] = 'valid prior pick'; game.playerPicks[key] = answers[key]; }
  game.turn = 'X'; h.setGame(game);
  await h.send(h.ids.indexOf(game.teams.X[0]), { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key: '2-2', playerId: answers['2-2'] });
  assert.equal(h.game.winner, 'draw'); assert.deepEqual(h.game.series.scores, { X: 0, O: 0 });
  await h.send(0, { type: 'next-xox', boardId: game.boardId }); assert.deepEqual(h.game.teams, game.teams); assert.equal(h.game.series.history.length, 1);
});
