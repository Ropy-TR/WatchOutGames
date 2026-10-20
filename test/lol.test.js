import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/lol.json' with { type: 'json' };
import { createLolBoard, lolBoardHasSolution, lolCellCandidates, validateLolPick, hasAvailableLolMove, lolCatalog, searchLolChampions, LOL_MODES } from '../src/lol.js';
import { championBio, currentWikiText, wikiSpecies, wikiRegions, parseChampionLua } from '../scripts/lol-import.mjs';
import { roomHarness } from './room-harness.js';
import worker from '../src/worker.js';

function randomSource() { let seed = 123456; return (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; }; }
const champion = (key) => data.champions.find((champion) => champion.key === key);
function solve(game) {
  const cells = Array.from({ length: 9 }, (_, n) => ({ key: Math.floor(n / 3) + '-' + n % 3, candidates: lolCellCandidates(game, Math.floor(n / 3), n % 3) })).sort((a, b) => a.candidates.length - b.candidates.length);
  const used = new Set(), answers = {};
  function visit(n) {
    if (n === 9) return true;
    for (const id of cells[n].candidates) { if (used.has(id)) continue; used.add(id); answers[cells[n].key] = id; if (visit(n + 1)) return true; used.delete(id); }
    return false;
  }
  assert.ok(visit(0)); return answers;
}
test('LoL snapshot includes every official roster entry once, including recent champions', () => {
  assert.equal(data.champions.length, data.rosterCount); assert.ok(data.rosterCount >= 173);
  assert.equal(new Set(data.champions.map((c) => c.id)).size, data.rosterCount);
  for (const name of ['Mel','Yunara','Zaahen','Locke','Ambessa']) assert.ok(champion(name));
  const attributes = new Set(data.attributes.map((a) => a.id));
  for (const entry of data.champions) {
    assert.match(entry.id, /^\d+$/); assert.ok(entry.attributes.every((id) => attributes.has(id)));
    for (const type of ['region:','species:','lane:','class:']) assert.ok(entry.attributes.some((id) => id.startsWith(type)), entry.key + ' ' + type);
    assert.ok(entry.sources.every((source) => source.revision && source.url.startsWith('https://wiki.leagueoflegends.com/')));
    assert.ok(entry.icon.startsWith('https://ddragon.leagueoflegends.com/cdn/' + data.patch + '/img/champion/'));
  }
});
test('Wiki-derived facts distinguish current species, origin, affiliation and multi-character champions', () => {
  assert.ok(champion('Ahri').attributes.includes('species:vastaya'));
  assert.ok(champion('Ahri').attributes.includes('region:ionia'));
  assert.ok(champion('Teemo').attributes.includes('species:yordle'));
  assert.ok(champion('Yuumi').attributes.includes('species:cat')); assert.ok(!champion('Yuumi').attributes.includes('species:yordle'));
  assert.ok(champion('Aatrox').attributes.includes('species:darkin')); assert.ok(!champion('Aatrox').attributes.includes('species:human'));
  assert.ok(champion('Aatrox').attributes.includes('origin:shurima'));
  assert.ok(champion('Sona').attributes.includes('origin:ionia')); assert.ok(champion('Sona').attributes.includes('region:demacia'));
  assert.ok(champion('Mel').attributes.includes('region:noxus')); assert.ok(!champion('Mel').attributes.includes('region:piltover'));
  assert.ok(champion('Nunu').attributes.includes('species:human') && champion('Nunu').attributes.includes('species:yeti'));
  assert.equal(champion('Nunu').sources.length, 2);
});
test('Wiki parser handles nested templates and never includes struck-out or former species', () => {
  const parsed = championBio('{{Section top}}\n{{Champion bio|Test|gallery={{GalleryHelper|a|b}}|species=[[Darkin]]<small>(formerly [[Human]])</small>\n* <s>[[Human]]</s>|region={{fi|Noxus|display}}\n* <s>{{fi|Piltover}}</s>|originplace=[[Shurima]]}}');
  assert.deepEqual(wikiSpecies(parsed.species), ['Darkin']); assert.deepEqual(wikiRegions(parsed.region), ['Noxus']);
  assert.ok(!currentWikiText(parsed.species).includes('Human'));
  assert.throws(() => championBio('{{Champion bio|Test|species=[[Human]]'));
});
test('Lua gameplay parser reads fields as data, not executable code, and ignores alternate-form IDs', () => {
  const lua = 'return {\n  ["Test"] = {\n ["id"]=1, ["apiname"]="Test", ["client_positions"]={"Middle"}, ["external_positions"]={"Middle","Support"}, ["role"]={"Mage"},\n  },\n  ["Other Form"] = { ["id"]=1.2, ["apiname"]="TestForm" },\n}';
  const entries = parseChampionLua(lua); assert.equal(entries.size, 1); assert.deepEqual(entries.get('1').positions, ['Middle','Support']);
});
test('Every LoL mode generates 200 independently solvable nonduplicate grids', () => {
  const random = randomSource();
  for (const mode of LOL_MODES) for (let n = 0; n < 200; n++) {
    const game = createLolBoard({ mode: mode.id }, random);
    assert.equal(new Set(game.topIds).size, 3); assert.equal(new Set(game.sideIds).size, 3); assert.equal(lolBoardHasSolution(game), true);
    const answers = solve(game); assert.equal(new Set(Object.values(answers)).size, 9);
    for (const [key, championId] of Object.entries(answers)) assert.equal(validateLolPick(game, { boardId: game.boardId, key, championId }).id, championId);
  }
});
test('LoL validation rejects incorrect, unknown, repeated, occupied and stale picks', () => {
  const game = createLolBoard({ mode: 'region-lane' }, randomSource());
  const correct = lolCellCandidates(game, 0, 0)[0], wrong = data.champions.find((champion) => !lolCellCandidates(game, 0, 0).includes(champion.id)).id;
  const pick = { boardId: game.boardId, key: '0-0', championId: correct };
  for (const patch of [{ championId: wrong }, { championId: 'Q615' }, { key: '9-9' }, { boardId: 'old' }]) assert.throws(() => validateLolPick(game, { ...pick, ...patch }));
  assert.throws(() => validateLolPick({ ...game, dataVersion: 'old' }, pick));
  game.playerPicks['2-2'] = correct; assert.throws(() => validateLolPick(game, pick));
  game.playerPicks = {}; game.picks['0-0'] = 'occupied'; assert.throws(() => validateLolPick(game, pick));
});
test('Custom LoL grids reject unknown axes, wrong property types, duplicates and impossible intersections', () => {
  const game = createLolBoard({ mode: 'region-lane' }, randomSource());
  assert.throws(() => createLolBoard({ mode: 'region-lane', topIds: [game.topIds[0],game.topIds[0],game.topIds[2]], sideIds: game.sideIds }, randomSource()));
  assert.throws(() => createLolBoard({ mode: 'region-lane', topIds: ['region:does-not-exist', ...game.topIds.slice(1)], sideIds: game.sideIds }, randomSource()));
  assert.throws(() => createLolBoard({ mode: 'region-lane', topIds: game.sideIds, sideIds: game.topIds }, randomSource()));
  assert.throws(() => createLolBoard({ mode: 'region-lane', topIds: ['region:ixtal','region:demacia','region:noxus'], sideIds: ['lane:top','lane:middle','lane:bottom'] }, randomSource()));
});
test('LoL catalog and searches include names/icons but do not reveal champion memberships', async () => {
  const response = await worker.fetch(new Request('https://test/api/lol'), {}); const catalog = await response.json();
  assert.equal(catalog.championCount, data.rosterCount); assert.equal(catalog.modes.length, 5);
  assert.ok(catalog.champions.every((c) => !('attributes' in c))); assert.ok(JSON.stringify(catalog).length < 60000);
  for (const [query, key] of [['MonkeyKing','MonkeyKing'],['cho gath','Chogath'],['kha zix','Khazix'],['Nunu','Nunu']]) assert.ok(searchLolChampions(query).some((c) => c.id === champion(key).id));
  assert.deepEqual(searchLolChampions(''), []);
  const search = await worker.fetch(new Request('https://test/api/lol/search?q=Ahri'), {});
  assert.equal((await search.json()).players[0].id, champion('Ahri').id);
});
test('LoL server enforces team turn, canonical names and game-specific message types', async () => {
  const h = await roomHarness(4); await h.send(0, { type: 'start-lol-xox', mode: 'region-lane' }); const game = h.game;
  assert.equal(game.kind, 'lol-xox'); assert.equal(game.teams.X.length, 2); assert.ok(game.deadline - Date.now() > 29000);
  const actor = h.ids.indexOf(game.teams[game.turn][0]), wrongActor = h.ids.indexOf(game.teams[game.turn === 'X' ? 'O' : 'X'][0]);
  const championId = lolCellCandidates(game, 0, 0)[0]; const msg = { type: 'pick-lol-xox', boardId: game.boardId, turnId: game.turnId, key: '0-0', championId, name: 'Forged' };
  await h.send(wrongActor, msg); assert.deepEqual(h.game.picks, {});
  await h.send(actor, { ...msg, type: 'pick-xox', playerId: championId }); assert.deepEqual(h.game.picks, {});
  await h.send(actor, msg); assert.equal(h.game.picks['0-0'], data.champions.find((c) => c.id === championId).name);
  assert.equal(h.last().game.pickedChampionIds['0-0'], championId); assert.ok(!('playerPicks' in h.last().game));
  const after = h.game; await h.send(actor, msg); assert.deepEqual(h.game, after);
});
test('LoL wrong answer consumes a turn, pass and server alarm advance correctly', async () => {
  const h = await roomHarness(2); await h.send(0, { type: 'start-lol-xox' }); let game = h.game;
  await h.send(h.ids.indexOf(game.teams[game.turn][0]), { type: 'pick-lol-xox', boardId: game.boardId, turnId: game.turnId, key: '0-0', championId: 'not-a-champion' });
  assert.notEqual(h.game.turn, game.turn); assert.deepEqual(h.game.picks, {});
  game = h.game; await h.send(h.ids.indexOf(game.teams[game.turn][0]), { type: 'pass-lol-xox', boardId: game.boardId, turnId: game.turnId }); assert.notEqual(h.game.turn, game.turn);
  game = h.game; game.deadline = Date.now() - 1; h.setGame(game); await h.room.alarm(); assert.notEqual(h.game.turnId, game.turnId);
});
test('LoL two valid lines win a best-of-three series, preserve teams and reject further rounds', async () => {
  const h = await roomHarness(4); await h.send(0, { type: 'start-lol-xox' }); const teams = h.game.teams;
  for (let round = 1; round <= 2; round++) {
    const answers = solve(h.game);
    for (const key of ['0-0','0-1','0-2']) {
      let game = h.game;
      if (game.turn !== 'X') { await h.send(h.ids.indexOf(game.teams.O[0]), { type: 'pass-lol-xox', boardId: game.boardId, turnId: game.turnId }); game = h.game; }
      await h.send(h.ids.indexOf(game.teams.X[0]), { type: 'pick-lol-xox', boardId: game.boardId, turnId: game.turnId, key, championId: answers[key] });
    }
    assert.equal(h.game.winner, 'X'); assert.equal(h.game.series.scores.X, round);
    if (round === 1) { await h.send(0, { type: 'next-lol-xox', boardId: h.game.boardId }); assert.deepEqual(h.game.teams, teams); }
  }
  assert.equal(h.game.series.finished, true); assert.equal(h.game.series.winner, 'X'); assert.equal(h.alarmAt, null);
  const game = h.game; await h.send(0, { type: 'next-lol-xox', boardId: game.boardId }); assert.equal(h.game.boardId, game.boardId);
  await h.send(0, { type: 'start-lol-xox', boardId: game.boardId, restart: true }); assert.deepEqual(h.game.series.scores, { X: 0, O: 0 });
});
test('LoL finite move detection and stale dataset do not expose old answers', async () => {
  const game = createLolBoard({ mode: 'region-class' }, randomSource()); assert.equal(hasAvailableLolMove(game), true);
  const answer = solve(game); game.playerPicks = answer; game.picks = Object.fromEntries(Object.keys(answer).map((key) => [key, 'filled'])); assert.equal(hasAvailableLolMove(game), false);
  const h = await roomHarness(2); await h.send(0, { type: 'start-lol-xox' }); const stale = h.game; stale.dataVersion = 'old'; assert.equal(h.room.publicGame(stale), null);
});
