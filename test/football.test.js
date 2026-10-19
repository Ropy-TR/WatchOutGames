import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/football.json' with { type: 'json' };
import { createFootballBoard, cellCandidates, validateFootballPick, footballCatalog, searchFootballPlayers } from '../src/football.js';
import clubConfig from '../scripts/football-clubs.json' with { type: 'json' };
import leagueConfig from '../scripts/football-leagues.json' with { type: 'json' };
import worker, { Room } from '../src/worker.js';

function randomSource() {
  let seed = 123456;
  return (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
}

// Independent exhaustive search, rather than the generator's augmenting-path matcher.
function solve(game) {
  const cells = Array.from({ length: 9 }, (_, n) => cellCandidates(game, Math.floor(n / 3), n % 3)).sort((a,b) => a.length - b.length);
  const used = new Set();
  function visit(index) {
    if (index === 9) return true;
    for (const id of cells[index]) {
      if (used.has(id)) continue;
      used.add(id);
      if (visit(index + 1)) return true;
      used.delete(id);
    }
    return false;
  }
  return visit(0);
}

test('snapshot uses real Wikidata IDs, positive appearances and known careers', () => {
  assert.ok(data.players.length > 200);
  const clubIds = new Set(data.clubs.map((club) => club.id));
  for (const player of data.players) {
    assert.match(player.id, /^Q\d+$/);
    assert.ok(player.name && player.memberships.length);
    assert.ok(player.memberships.every((m) => m.appearances > 0 && clubIds.has(m.club)));
  }
  const ronaldo = data.players.find((p) => p.id === 'Q11571');
  assert.ok(ronaldo.clubs.includes('Q8682') && ronaldo.clubs.includes('Q18656'));
  const messi = data.players.find((p) => p.id === 'Q615');
  assert.ok(messi.clubs.includes('Q7156') && messi.clubs.includes('Q483020') && messi.countries.includes('Q414'));
});

test('catalog contains every selected season club from all eleven leagues', () => {
  assert.equal(data.clubs.length, clubConfig.length);
  assert.equal(data.leagues.length, 11);
  assert.ok(data.clubs.length >= 190);
  assert.equal(data.catalogHash.length, 64);
  for (const league of leagueConfig.leagues) {
    assert.equal(data.clubs.filter((club) => club.league === league.id).length, league.clubCount);
  }
});

test('random boards in both modes admit nine distinct answers', () => {
  const random = randomSource();
  for (const mode of ['clubs', 'countries']) {
    for (let i = 0; i < 100; i++) {
      const game = createFootballBoard({ mode }, random);
      assert.equal(solve(game), true);
      assert.equal(new Set(game.topIds).size, 3);
      assert.equal(new Set(game.sideIds).size, 3);
    }
  }
});

test('picks reject unknown, repeated, occupied, out-of-range and stale answers', () => {
  const game = createFootballBoard({ mode: 'clubs' }, randomSource());
  const playerId = cellCandidates(game, 0, 0)[0];
  const pick = { boardId: game.boardId, key: '0-0', playerId };
  assert.equal(validateFootballPick(game, pick).id, playerId);
  assert.throws(() => validateFootballPick(game, { ...pick, playerId: 'Q1' }));
  assert.throws(() => validateFootballPick(game, { ...pick, key: '3-0' }));
  assert.throws(() => validateFootballPick(game, { ...pick, boardId: 'old' }));
  assert.throws(() => validateFootballPick({ ...game, dataVersion: 'old-data' }, pick));
  game.playerPicks['2-2'] = playerId;
  assert.throws(() => validateFootballPick(game, pick));
  game.playerPicks = {};
  game.picks['0-0'] = 'Already occupied';
  assert.throws(() => validateFootballPick(game, pick));
});

test('custom boards reject duplicate axes and non-catalog IDs', () => {
  assert.throws(() => createFootballBoard({ topIds: ['Q8682','Q8682','Q1543'], sideIds: ['Q7156','Q9617','Q18656'] }, randomSource()));
  assert.throws(() => createFootballBoard({ topIds: ['Q1','Q8682','Q1543'], sideIds: ['Q7156','Q9617','Q18656'] }, randomSource()));
});

test('catalog is small and player search accepts aliases without leaking membership answers', async () => {
  const result = await worker.fetch(new Request('https://example.test/api/football'), {});
  assert.equal(result.status, 200);
  const catalog = await result.json();
  assert.equal(catalog.playerCount, data.players.length);
  assert.ok(!('players' in catalog));
  assert.ok(JSON.stringify(catalog).length < 100000);
  assert.ok(footballCatalog().countries.length > 3);
  assert.ok(searchFootballPlayers('CR7').some((p) => p.id === 'Q11571'));
  assert.equal(searchFootballPlayers('').length, 0);
  assert.ok(searchFootballPlayers('a').length <= 35);
  const search = await worker.fetch(new Request('https://example.test/api/football/search?q=CR7'), {});
  assert.equal(search.status, 200);
  const { players } = await search.json();
  assert.ok(players.some((p) => p.id === 'Q11571'));
  assert.ok(players.every((p) => !('clubs' in p) && !('memberships' in p)));
});

test('room stores the canonical player name and rejects forged or occupied answers', async () => {
  const state = new Map([['room', { password: 'test', members: [], game: null }]]);
  const room = new Room({ storage: {
    get: async (key) => structuredClone(state.get(key)),
    put: async (key, value) => state.set(key, structuredClone(value))
  } });
  const messages = [];
  const socket = { readyState: 1, send: (raw) => messages.push(JSON.parse(raw)) };
  await room.onMessage(socket, JSON.stringify({ type: 'join', password: 'test', nickname: 'Test' }));
  const secondSocket = { readyState: 1, send: (raw) => messages.push(JSON.parse(raw)) };
  await room.onMessage(secondSocket, JSON.stringify({ type: 'join', password: 'test', nickname: 'Test 2' }));
  await room.onMessage(socket, JSON.stringify({ type: 'start-xox', mode: 'countries' }));
  const game = state.get('room').game;
  const playerId = cellCandidates(game, 0, 0)[0];
  const turnSocket = [...room.clients].find(([, id]) => game.teams[game.turn].includes(id))[0];
  const pick = { type: 'pick-xox', boardId: game.boardId, turnId: game.turnId, key: '0-0', playerId, name: 'Forged name' };
  await room.onMessage(turnSocket, JSON.stringify(pick));
  assert.equal(state.get('room').game.picks['0-0'], data.players.find((p) => p.id === playerId).name);
  assert.ok(!('playerPicks' in messages.filter((msg) => msg.type === 'game').at(-1).game));
  assert.deepEqual(messages.filter((msg) => msg.type === 'game').at(-1).game.pickedPlayerIds, { '0-0': playerId });
  await room.onMessage(turnSocket, JSON.stringify(pick));
  assert.equal(messages.at(-1).type, 'error');
  const before = structuredClone(state.get('room').game.picks);
  await room.onMessage(socket, JSON.stringify({ ...pick, key: '1-1', playerId: 'Q1' }));
  assert.deepEqual(state.get('room').game.picks, before);
});
