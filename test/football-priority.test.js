import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/data/football.json' with { type: 'json' };
import priority from '../src/data/football-priority.json' with { type: 'json' };
import { drawFootballPlan, sampleFootballClubs } from '../src/football-priority.js';
import { createFootballBoard, boardHasSolution, footballCatalog } from '../src/football.js';
const preferred = new Set(Object.values(priority.leagues).flat().map((club) => club.id));
const elite = new Set(priority.worldTop30.map((club) => club.id));
const turkish = new Set(priority.leagues.turkey.map((club) => club.id));
const four = new Set(priority.turkishBigFour.map((club) => club.id));
function rng(initial = 123456) {
  let seed = initial;
  return (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * max); };
}
test('Strict catalog keeps all Turkish clubs, six big-league clubs and selected leaders', () => {
  assert.equal(Object.keys(priority.leagues).length, 12);
  for (const [league, list] of Object.entries(priority.leagues)) {
    if (['england','italy','spain','germany','france'].includes(league)) assert.equal(list.length, 6);
    else if (league === 'turkey') assert.equal(list.length, data.clubs.filter((c) => c.league === 'turkey').length);
    else assert.ok(list.length >= 2 && list.length <= 4);
    for (const club of list) assert.equal(data.clubs.find((item) => item.id === club.id)?.league, league);
  }
  assert.equal(preferred.size, 65); assert.equal(elite.size, 30);
  for (const id of elite) assert.ok(data.clubs.some((club) => club.id === id));
});
test('Probability boundaries: 80 percent elite, 90 percent Turkish, 95 percent big four', () => {
  for (let ticket = 0; ticket < 100; ticket++) {
    let calls = 0;
    const plan = drawFootballPlan('clubs', () => calls++ === 0 ? ticket : 0);
    assert.equal(plan.profile === 'elite', ticket < 80);
    calls = 0;
    const tr = drawFootballPlan('clubs', () => calls++ === 1 ? ticket : 0);
    assert.equal(Boolean(tr.turkishId), ticket < 90);
    calls = 0;
    const big = drawFootballPlan('clubs', () => calls++ === 2 ? ticket : 0);
    assert.equal(four.has(big.turkishId), ticket < 95);
  }
});
test('Weighted draw never repeats or escapes supplied pool', () => {
  const pool = [...elite].slice(0, 12);
  assert.deepEqual(sampleFootballClubs([...pool, ...pool], 15, () => 0), pool);
});
test('Two thousand solvable boards honor strict pools and probabilities', (t) => {
  for (const mode of ['clubs', 'countries']) {
    const random = rng(); let eliteBoards = 0, trBoards = 0, bigBoards = 0;
    for (let i = 0; i < 1000; i++) {
      const board = createFootballBoard({ mode }, random);
      assert.equal(boardHasSolution(board), true);
      const ids = mode === 'clubs' ? [...board.topIds, ...board.sideIds] : board.topIds;
      assert.equal(new Set(ids).size, ids.length);
      const tr = ids.filter((id) => turkish.has(id)); assert.ok(tr.length <= 1);
      const pool = board.selectionProfile === 'elite' ? elite : preferred;
      for (const id of ids) assert.ok(turkish.has(id) || pool.has(id));
      for (const id of ids) assert.ok(preferred.has(id));
      eliteBoards += board.selectionProfile === 'elite'; trBoards += tr.length; bigBoards += four.has(tr[0]);
    }
    assert.ok(eliteBoards > 740 && eliteBoards < 860);
    assert.ok(trBoards > 850 && trBoards < 950);
    assert.ok(bigBoards / trBoards > 0.91 && bigBoards / trBoards < 0.99);
    t.diagnostic(`${mode}: elite ${eliteBoards}/1000, Turkish ${trBoards}/1000, big four ${bigBoards}/${trBoards}`);
  }
});
test('Turkish draws retain their class and slot or use a solvable domestic alternative', () => {
  for (const mode of ['clubs', 'countries']) for (const id of turkish) {
    const big = four.has(id), candidates = big ? [...four] : [...turkish].filter((item) => !four.has(item));
    for (let slot = 0; slot < (mode === 'clubs' ? 6 : 3); slot++) {
      const tickets = [0, 0, big ? 0 : 99, candidates.indexOf(id), slot], random = rng(5541 + slot);
      const board = createFootballBoard({ mode }, (max) => tickets.length ? tickets.shift() : random(max));
      const ids = mode === 'clubs' ? [...board.topIds, ...board.sideIds] : board.topIds;
      assert.ok(turkish.has(ids[slot])); assert.equal(four.has(ids[slot]), big);
      assert.equal(board.selectionProfile, 'elite'); assert.ok(boardHasSolution(board));
    }
  }
});
test('Public and manual catalogs exclude removed clubs', () => {
  const catalog = footballCatalog();
  assert.equal(catalog.clubs.length, preferred.size);
  assert.equal(catalog.clubs.filter((c) => c.league === 'turkey').length, 18);
  for (const c of catalog.clubs) assert.ok(preferred.has(c.id));
  for (const id of ['Q19453','Q19571','Q1120838']) {
    assert.ok(!catalog.clubs.some((c) => c.id === id));
    assert.throws(() => createFootballBoard({ topIds: [id,'Q8682','Q7156'], sideIds: ['Q631','Q9617','Q483020'] }, rng()));
  }
});
