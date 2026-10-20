// Optional full-browser integration run against a running `wrangler dev`.
// Uses an already available Playwright package and an installed Chrome browser.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { cellCandidates } from '../src/football.js';
import data from '../src/football-dataset.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pages = [], contexts = [], errors = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  do { if (await check()) return; await pause(40); } while (Date.now() < deadline);
  throw new Error('Timeout: ' + message);
}
const game = (n = 0) => pages[n].evaluate(() => currentGame);
const id = (n) => pages[n].evaluate(() => playerId);
const click = (n, selector) => pages[n].locator(selector).click();
const view = (n = 0) => pages[n].locator('#activeGame');
async function menu() {
  await click(0, '[data-action="menu"]');
  await until(async () => (await game()) === null, 'menu');
}
async function searchPick(n, key, playerId) {
  const player = data.players.find((p) => p.id === playerId);
  await click(n, '[data-xox-cell="' + key + '"]');
  await pages[n].locator('#playerSearch').fill(player.name);
  await click(n, '[data-player="' + playerId + '"]');
  await until(async () => !await pages[n].locator('#playerDialog').evaluate((el) => el.open), 'football dialog close');
}
try {
  for (let n = 0; n < 4; n++) {
    const context = await browser.newContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', (error) => errors.push(error.message));
    // Image metadata is independent and covered by its own tests. Avoid third-party
    // latency here; all room, game, search and clock requests remain real.
    await page.route('**/api/football/media?*', (route) => route.fulfill({ json: { items: {} } }));
    await page.goto(base);
  }
  await click(0, '[data-tab="create"]');
  await pages[0].locator('#createNickname').fill('Ada');
  await pages[0].locator('#createPassword').fill('gece');
  await click(0, '#createForm button[type="submit"]');
  await until(async () => (await pages[0].locator('#roomCodeLabel').innerText()) !== '-----', 'room creation');
  const code = await pages[0].locator('#roomCodeLabel').innerText();
  for (let n = 1; n < 4; n++) {
    await pages[n].locator('#joinNickname').fill(['Ada','Bora','Cem','Deniz'][n]);
    await pages[n].locator('#joinCode').fill(code); await pages[n].locator('#joinPassword').fill('gece');
    await click(n, '#joinForm button[type="submit"]');
    await until(async () => await pages[n].locator('#room').isVisible(), 'join ' + n);
  }
  await until(async () => (await pages[0].locator('#playerCount').innerText()) === '4 / 8', 'four players');
  console.log('PASS: four isolated browser sessions joined over real WebSockets');

  await click(0, '[data-game="spy"]');
  await until(async () => (await pages[0].locator('[data-category]').count()) === 12, 'category catalog');
  await click(0, '[data-category="Spor dalları"]');
  await click(0, '[data-action="start-spy"]');
  await until(async () => (await game(3))?.kind === 'spyfall', 'spy broadcast');
  const roles = await Promise.all(pages.map((page) => page.evaluate(() => myRole)));
  assert.equal(roles.filter((role) => role.spy).length, 1);
  const lists = await Promise.all(pages.map((page) => page.locator('.spy-candidates').innerText()));
  assert.ok(lists.every((list) => list === lists[0])); assert.ok(lists[0].includes('Futbol'));
  for (const n of [0,1,2,3]) {
    const heading = await pages[n].locator('.spy-role h3').innerText();
    assert.equal(heading, roles[n].spy ? 'Sen casussun' : roles[n].location);
  }
  const oldId = await id(2);
  await pages[2].reload();
  await pages[2].locator('#joinNickname').fill('Cem'); await pages[2].locator('#joinCode').fill(code); await pages[2].locator('#joinPassword').fill('gece');
  await click(2, '#joinForm button[type="submit"]');
  await until(async () => (await game(2))?.kind === 'spyfall', 'spy reconnect');
  assert.equal(await id(2), oldId); assert.deepEqual(await pages[2].evaluate(() => myRole), roles[2]);
  console.log('PASS: 12 Spyfall categories, matching lists for spy/innocents, private roles survive reload');

  const spyIds = await Promise.all(pages.map((_, n) => id(n)));
  const allSpyState = async () => {
    const state = await game();
    await until(async () => (await Promise.all(pages.map((_, n) => game(n)))).every((g) => g.gameId === state.gameId && g.phase === state.phase), 'synchronized spy phase');
    return state;
  };
  const nextSpy = async () => {
    const before = await game(); await click(0, '[data-action="next-spy"]');
    await until(async () => (await game()).gameId !== before.gameId, 'next spy round'); return allSpyState();
  };
  const spyDetails = async () => {
    const values = await Promise.all(pages.map((page) => page.evaluate(() => myRole)));
    return { actor: values.findIndex((role) => role.spy), location: values.find((role) => !role.spy).location };
  };
  const accuse = async (target) => {
    await click(0, '[data-action="spy-vote"]');
    await until(async () => (await game(3)).phase === 'voting', 'spy vote begins');
    for (let n = 0; n < 3; n++) {
      await click(n, '[data-spy-vote="' + target + '"]');
      await until(async () => { const state = await game(); return state.phase !== 'voting' || state.vote.votedIds.length >= n + 1; }, 'vote counted');
    }
    return allSpyState();
  };
  const submitGuess = async (actor, location) => {
    await until(async () => await pages[actor].locator('#spyGuessForm').isVisible(), 'guess form');
    await pages[actor].locator('#spyGuessLocation').selectOption(location);
    await click(actor, '#spyGuessForm button');
    await until(async () => (await game()).phase === 'results', 'guess result'); return allSpyState();
  };
  let sd = await spyDetails();
  let scored = await accuse(spyIds.find((_, n) => n !== sd.actor));
  assert.equal(scored.match.scores[spyIds[sd.actor]], 2); assert.ok((await view().innerText()).includes('Yanlış kişi seçildi'));
  await nextSpy(); sd = await spyDetails();
  let previousScores = (await game()).match.scores;
  await click(sd.actor, '[data-action="spy-guess"]');
  scored = await submitGuess(sd.actor, sd.location);
  assert.equal(scored.match.scores[spyIds[sd.actor]], previousScores[spyIds[sd.actor]] + 2);
  await nextSpy(); sd = await spyDetails(); previousScores = (await game()).match.scores;
  await accuse(spyIds[sd.actor]); assert.ok((await view().innerText()).includes('son tahmin'));
  scored = await submitGuess(sd.actor, sd.location);
  assert.equal(scored.match.scores[spyIds[sd.actor]], previousScores[spyIds[sd.actor]] + 1);
  await nextSpy(); sd = await spyDetails(); previousScores = (await game()).match.scores;
  await accuse(spyIds[sd.actor]); scored = await submitGuess(sd.actor, (await game()).candidates.find((word) => word !== sd.location));
  for (let n = 0; n < 4; n++) assert.equal(scored.match.scores[spyIds[n]], previousScores[spyIds[n]] + (n === sd.actor ? 0 : 2));
  for (let turn = 0; turn < 20 && !scored.match.finished; turn++) {
    await nextSpy(); sd = await spyDetails(); await click(sd.actor, '[data-action="spy-guess"]'); scored = await submitGuess(sd.actor, sd.location);
  }
  assert.ok(scored.match.finished); assert.ok(scored.match.winners.every((winner) => scored.match.scores[winner] >= 10));
  assert.ok((await view().innerText()).includes('Maç bitti')); assert.equal(await pages[0].locator('[data-action="next-spy"]').count(), 0);
  await click(0, '[data-action="new-spy-match"]');
  await until(async () => !(await game()).match.finished, 'new spy match');
  assert.ok(Object.values((await game()).match.scores).every((points) => points === 0));
  console.log('PASS: Spyfall votes and all scoring paths, final caught guess, 10-point match and score reset');

  await menu(); await click(0, '[data-game="code"]');
  await until(async () => (await game(3))?.phase === 'lobby', 'code lobby');
  for (let n = 0; n < 4; n++) {
    const team = n < 2 ? 'red' : 'blue', role = n % 2 ? 'guesser' : 'master';
    await click(n, '[data-code-team="' + team + '"][data-code-role="' + role + '"]');
    await until(async () => Object.keys((await game()).assignments).length >= n + 1, 'code assignment');
  }
  await click(0, '[data-action="begin-code"]');
  await until(async () => (await game(3))?.phase === 'playing', 'code begin');
  const redMap = await pages[0].evaluate(() => masterKeys), blueMap = await pages[2].evaluate(() => masterKeys);
  assert.deepEqual(redMap, blueMap); assert.equal(redMap.length, 25);
  for (const n of [0,2]) { assert.equal(await pages[n].locator('.word-card.red').count(), redMap.filter((key) => key === 'red').length); assert.equal(await pages[n].locator('.word-card:enabled').count(), 0); }
  for (const n of [1,3]) { assert.equal(await pages[n].evaluate(() => masterKeys), null); assert.equal(await pages[n].locator('.word-card.red,.word-card.blue,.word-card.assassin').count(), 0); }
  let cg = await game(); const master = cg.turn === 'red' ? 0 : 2, guesser = master + 1;
  await pages[master].locator('#codeClueForm [name="word"]').fill('bağlantı');
  await pages[master].locator('#codeClueForm [name="count"]').selectOption('1');
  await click(master, '#codeClueForm button');
  await until(async () => (await game(guesser)).clue?.word === 'bağlantı', 'clue');
  const correct = redMap.flatMap((key, i) => key === cg.turn ? [i] : []);
  await click(guesser, '[data-pick="' + correct[0] + '"]');
  await until(async () => (await game(3)).revealed.length === 1, 'first guess');
  assert.equal(await pages[guesser].locator('[data-pick="' + correct[0] + '"]').getAttribute('class'), 'word-card ' + cg.turn);
  await click(guesser, '[data-pick="' + correct[1] + '"]');
  await until(async () => (await game()).turn !== cg.turn, 'guess allowance switches turn');
  cg = await game(); const nextMaster = cg.turn === 'red' ? 0 : 2;
  await pages[nextMaster].locator('#codeClueForm [name="word"]').fill('bağlantı'); await click(nextMaster, '#codeClueForm button');
  await until(async () => (await game(nextMaster + 1)).clue, 'second clue');
  await click(nextMaster + 1, '[data-pick="' + redMap.indexOf('assassin') + '"]');
  await until(async () => (await game()).phase === 'finished', 'assassin');
  assert.ok((await view().innerText()).includes('kazandı')); assert.equal(await pages[1].locator('.word-card:enabled').count(), 0);
  console.log('PASS: two spymasters see same map; guessers see revealed colors; clues, extra guess and assassin work');

  await menu(); await click(0, '[data-game="city"]');
  await until(async () => (await game(3))?.kind === 'city', 'city start');
  let city = await game(); const letter = city.letter;
  await pages[0].locator('.city-field input[name="İsim"]').fill(letter + ' deneme');
  await pages[1].locator('.city-field input[name="İsim"]').fill(letter + ' ortak');
  await click(1, '[data-action="submit-city"]');
  await until(async () => (await game()).submittedIds.length === 1, 'city submit');
  assert.equal(await pages[0].locator('.city-field input[name="İsim"]').inputValue(), letter + ' deneme');
  assert.ok(!(await view().innerText()).includes(letter + ' ortak'));
  for (const n of [0,2,3]) {
    if (n) await pages[n].locator('.city-field input[name="İsim"]').fill(letter + (n === 2 ? ' ortak' : ' farklı'));
    await click(n, '[data-action="submit-city"]');
  }
  await until(async () => (await game()).phase === 'results', 'city results');
  city = await game();
  assert.equal(city.scores[await id(0)].cells.İsim, 10); assert.equal(city.scores[await id(1)].cells.İsim, 5); assert.equal(city.scores[await id(2)].cells.İsim, 5);
  const target = await id(1);
  await click(0, '[data-city-review="' + target + '"][data-category="İsim"]');
  await until(async () => (await game()).scores[target].cells.İsim === 0, 'manual review');
  assert.equal((await game()).scores[await id(2)].cells.İsim, 10);
  console.log('PASS: city drafts survive rerenders, answers stay hidden, results and manual invalidation recalculate scores');

  for (let round = 2; round <= 5; round++) {
    await click(0, '[data-action="new-city"]');
    await until(async () => (await game(3)).match.round === round, 'city next round');
    const letter = (await game()).letter;
    for (let n = 0; n < 4; n++) {
      await pages[n].locator('.city-field input[name="İsim"]').fill(letter + ' farklı ' + n);
      await click(n, '[data-action="submit-city"]');
    }
    await until(async () => (await game()).phase === 'results', 'city round result');
    assert.equal((await game()).match.totals[await id(0)], round * 10);
  }
  assert.equal((await game()).match.finished, true);
  assert.ok((await view().innerText()).includes('Maç bitti'));
  assert.equal(await pages[0].locator('[data-action="new-city"]').innerText(), 'Yeni maç');
  await click(0, '[data-action="new-city"]');
  await until(async () => (await game()).match.round === 1, 'city reset');
  assert.ok(Object.values((await game()).match.totals).every((points) => points === 0));
  console.log('PASS: city five-round match, cumulative scoreboard, final winners and new-match reset');

  await menu(); await click(0, '[data-game="xox"]');
  await until(async () => (await game(3))?.kind === 'xox' && (await pages[0].locator('[data-xox-cell]').count()) === 9, 'xox');
  assert.ok(await pages[0].locator('[data-xox-mode="superlig"]').isVisible());
  await click(0, '[data-xox-mode="superlig"]');
  await until(async () => (await game(3))?.mode === 'superlig', 'Super Lig mode broadcasts');
  const domestic = new Set(data.clubs.filter((club) => club.league === 'turkey').map((club) => club.id));
  assert.ok([...(await game()).topIds,...(await game()).sideIds].every((club) => domestic.has(club)));
  for (const select of await pages[0].locator('.xox-team').all()) assert.equal(await select.locator('option').count(),18);
  console.log('PASS: Super Lig mode visible, all six headers domestic, manual selectors restricted to 18 clubs');
  const ids = await Promise.all(pages.map((_, n) => id(n)));
  let xg = await game(); let actor = ids.indexOf(xg.teams[xg.turn][0]);
  const wrongActor = ids.indexOf(xg.teams[xg.turn === 'X' ? 'O' : 'X'][0]);
  assert.equal(await pages[actor].locator('[data-xox-cell]:enabled').count(), 9); assert.equal(await pages[wrongActor].locator('[data-xox-cell]:enabled').count(), 0);
  const wrongId = ['Q11571','Q615'].find((p) => !cellCandidates(xg, 0, 0).includes(p));
  if (wrongId) {
    await searchPick(actor, '0-0', wrongId);
    await until(async () => (await game()).turnId !== xg.turnId, 'wrong answer turn');
    assert.equal(Object.keys((await game()).picks).length, 0);
  }
  xg = await game(); const oldTurn = xg.turnId;
  console.log('Waiting for actual 30-second Durable Object alarm...');
  await until(async () => (await game()).turnId !== oldTurn, 'real alarm expiry', 34000);
  assert.notEqual((await game()).turn, xg.turn);
  console.log('PASS: wrong answers pass the turn; real 30-second server alarm broadcasts next team');
  const starting = (await game()).turn; const used = new Set();
  const linePlayers = [];
  function choose(column) {
    if (column === 3) return true;
    for (const player of cellCandidates(xg, 0, column)) {
      if (used.has(player)) continue; used.add(player); linePlayers[column] = player;
      if (choose(column + 1)) return true; used.delete(player);
    }
    return false;
  }
  assert.ok(choose(0));
  for (let column = 0; column < 3; column++) {
    xg = await game(); actor = ids.indexOf(xg.teams[xg.turn][0]);
    if (xg.turn !== starting) {
      await click(actor, '[data-action="pass-xox"]'); await until(async () => (await game()).turnId !== xg.turnId, 'pass');
      xg = await game(); actor = ids.indexOf(xg.teams[xg.turn][0]);
    }
    await searchPick(actor, '0-' + column, linePlayers[column]);
    await until(async () => Object.keys((await game()).picks).length === column + 1, 'accepted player');
  }
  xg = await game(); assert.equal(xg.winner, starting);
  assert.equal(xg.series.scores[starting], 1);
  assert.equal(await pages[0].locator('.winning-cell').count(), 3); assert.equal(await pages[0].locator('[data-xox-cell]:enabled').count(), 0);
  const firstBoard = xg.boardId, originalTeams = xg.teams;
  await click(0, '[data-action="new-xox"]');
  await until(async () => (await game()).boardId !== firstBoard, 'next xox board');
  assert.deepEqual((await game()).teams, originalTeams); assert.equal((await game()).series.scores[starting], 1);
  assert.equal((await game()).mode,'superlig');
  assert.ok([...(await game()).topIds,...(await game()).sideIds].every((club) => domestic.has(club)));
  xg = await game(); used.clear(); assert.ok(choose(0));
  for (let column = 0; column < 3; column++) {
    xg = await game(); actor = ids.indexOf(xg.teams[xg.turn][0]);
    if (xg.turn !== starting) {
      await click(actor, '[data-action="pass-xox"]'); await until(async () => (await game()).turnId !== xg.turnId, 'series pass');
      xg = await game(); actor = ids.indexOf(xg.teams[xg.turn][0]);
    }
    await searchPick(actor, '0-' + column, linePlayers[column]);
    await until(async () => Object.keys((await game()).picks).length === column + 1, 'series accepted player');
  }
  assert.equal((await game()).series.finished, true); assert.equal((await game()).series.winner, starting);
  assert.equal((await game()).series.scores[starting], 2);
  assert.equal(await pages[0].locator('[data-action="new-xox"]').innerText(), 'Yeni seri');
  assert.ok((await view().innerText()).includes('Seriyi ' + starting + ' kazandı'));
  await pages[0].setViewportSize({ width: 390, height: 844 });
  assert.ok(await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no mobile horizontal overflow');
  await fs.mkdir('.cache/browser-results', { recursive: true });
  await pages[0].screenshot({ path: '.cache/browser-results/xox-mobile.png', fullPage: true });
  await click(0, '[data-action="new-xox"]');
  await until(async () => !(await game()).series.finished, 'new domestic series');
  assert.equal((await game()).mode,'superlig');
  assert.ok([...(await game()).topIds,...(await game()).sideIds].every((club) => domestic.has(club)));
  assert.deepEqual(errors, []);
  console.log('PASS: XOX best-of-three series 2–0, stable teams and scores, three-in-a-row wins, mobile fits, zero browser exceptions');
} finally { await browser.close(); }
