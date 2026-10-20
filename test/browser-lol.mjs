import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { lolCellCandidates } from '../src/lol.js';
import { cellCandidates } from '../src/football.js';
import data from '../src/data/lol.json' with { type: 'json' };
import football from '../src/football-dataset.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const pages = [], errors = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, message, timeout = 10000) {
  const end = Date.now() + timeout;
  do { if (await check()) return; await pause(40); } while (Date.now() < end);
  throw new Error('Timeout: ' + message);
}
const game = (n = 0) => pages[n].evaluate(() => currentGame);
const click = (n, selector) => pages[n].locator(selector).click();
function answers(game) {
  const result = [], used = new Set();
  function choose(column) {
    if (column === 3) return true;
    for (const id of lolCellCandidates(game, 0, column)) {
      if (used.has(id)) continue; used.add(id); result[column] = id;
      if (choose(column + 1)) return true; used.delete(id);
    }
    return false;
  }
  assert.ok(choose(0)); return result;
}
async function pick(n, key, championId) {
  await click(n, '[data-xox-cell="' + key + '"]');
  assert.equal(await pages[n].locator('#playerDialog h2').innerText(), 'Şampiyon seç');
  await pages[n].locator('#playerSearch').fill(data.champions.find((champion) => champion.id === championId).name);
  await click(n, '[data-player="' + championId + '"]');
  await until(async () => !await pages[n].locator('#playerDialog').evaluate((dialog) => dialog.open), 'pick closes dialog');
}
try {
  for (let n = 0; n < 4; n++) {
    const context = await browser.newContext(); const page = await context.newPage(); pages.push(page);
    page.on('pageerror', (error) => errors.push(error.message));
    // Deliberately unavailable portrait must leave the answer text usable.
    await page.route('https://ddragon.leagueoflegends.com/**/img/champion/**', (route) => route.fulfill({ status: 404, body: '' }));
    await page.route('**/api/football/media?*', (route) => route.fulfill({ json: { items: {} } }));
    await page.goto(base);
  }
  await click(0, '[data-tab="create"]'); await pages[0].locator('#createNickname').fill('Ada'); await pages[0].locator('#createPassword').fill('lol-test');
  await click(0, '#createForm button'); await until(async () => await pages[0].locator('#room').isVisible(), 'create');
  const code = await pages[0].locator('#roomCodeLabel').innerText();
  for (let n = 1; n < 4; n++) {
    await pages[n].locator('#joinNickname').fill('Oyuncu ' + n); await pages[n].locator('#joinCode').fill(code); await pages[n].locator('#joinPassword').fill('lol-test');
    await click(n, '#joinForm button'); await until(async () => await pages[n].locator('#room').isVisible(), 'join');
  }
  const ids = await Promise.all(pages.map((page) => page.evaluate(() => playerId)));
  await click(0, '[data-game="lol"]'); await until(async () => (await game(3))?.kind === 'lol-xox', 'lol broadcast');
  await until(async () => await pages[0].locator('#lolMode').isVisible(), 'mode selector');
  for (const mode of ['region-lane','species-lane','region-class','origin-lane','mixed']) {
    const previous = (await game()).boardId;
    await pages[0].locator('#lolMode').selectOption(mode);
    await until(async () => (await game(3)).mode === mode && (await game(3)).boardId !== previous, 'mode ' + mode);
    await until(async () => (await pages[0].locator('[data-xox-cell]').count()) === 9, 'grid');
  }
  assert.equal(await pages[0].evaluate(() => lolCatalog.championCount), data.rosterCount);
  console.log('PASS: four clients, all 173 champions, all five modes and nine synced cells');
  let state = await game(); let actor = ids.indexOf(state.teams[state.turn][0]);
  const wrong = ids.indexOf(state.teams[state.turn === 'X' ? 'O' : 'X'][0]);
  assert.equal(await pages[actor].locator('[data-xox-cell]:enabled').count(), 9); assert.equal(await pages[wrong].locator('[data-xox-cell]:enabled').count(), 0);
  const invalid = data.champions.find((champion) => !lolCellCandidates(state, 0, 0).includes(champion.id)).id;
  await pick(actor, '0-0', invalid);
  await until(async () => (await game()).turnId !== state.turnId, 'wrong answer passes turn');
  assert.deepEqual((await game()).picks, {});
  state = await game(); actor = ids.indexOf(state.teams[state.turn][0]);
  await click(actor, '[data-xox-cell="0-0"]'); assert.ok(await pages[actor].locator('#playerDialog').isVisible());
  const oldTurn = state.turnId;
  console.log('Waiting for real 30-second LoL turn alarm...');
  await until(async () => (await game()).turnId !== oldTurn, '30 second alarm', 34000);
  assert.notEqual((await game()).turn, state.turn); assert.equal(await pages[actor].locator('#playerDialog').evaluate((dialog) => dialog.open), false);
  const winningTeam = (await game()).turn; const originalTeams = (await game()).teams;
  for (let round = 1; round <= 2; round++) {
    const solution = answers(await game());
    for (let column = 0; column < 3; column++) {
      state = await game(); actor = ids.indexOf(state.teams[state.turn][0]);
      if (state.turn !== winningTeam) { await click(actor, '[data-action="pass-xox"]'); await until(async () => (await game()).turnId !== state.turnId, 'pass'); state = await game(); actor = ids.indexOf(state.teams[state.turn][0]); }
      await pick(actor, '0-' + column, solution[column]);
      await until(async () => Object.keys((await game()).picks).length === column + 1, 'canonical pick');
      assert.equal(await pages[0].locator('#lolMode').count(), 0);
    }
    state = await game(); assert.equal(state.winner, winningTeam); assert.equal(state.series.scores[winningTeam], round);
    await until(async () => (await pages[0].locator('.winning-cell').count()) === 3, 'winning line');
    assert.deepEqual(state.teams, originalTeams);
    if (round === 1) {
      const old = state.boardId; await click(0, '[data-action="new-lol"]');
      await until(async () => (await game(3)).boardId !== old, 'next board'); assert.equal((await game()).series.scores[winningTeam], 1);
    }
  }
  assert.equal((await game()).series.finished, true); assert.equal(await pages[0].locator('[data-action="new-lol"]').innerText(), 'Yeni seri');
  await pages[0].setViewportSize({ width: 390, height: 844 });
  assert.ok(await pages[0].evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await fs.mkdir('.cache/browser-results', { recursive: true }); await pages[0].screenshot({ path: '.cache/browser-results/lol-mobile.png', fullPage: true });
  assert.ok(await pages[0].locator('[data-xox-cell="0-0"] span').innerText());
  console.log('PASS: LoL 30s alarm, wrong/correct answers, modal closure, 2–0 series, image fallback and mobile layout');
  await click(0, '[data-action="new-lol"]'); await until(async () => !(await game()).series.finished, 'new series');
  assert.deepEqual((await game()).series.scores, { X: 0, O: 0 });
  await click(0, '[data-action="menu"]'); await until(async () => (await game()) === null, 'menu');
  await click(0, '[data-game="xox"]'); await until(async () => (await game(3))?.kind === 'xox', 'football');
  state = await game(); actor = ids.indexOf(state.teams[state.turn][0]);
  await click(actor, '[data-xox-cell="0-0"]'); assert.equal(await pages[actor].locator('#playerDialog h2').innerText(), 'Futbolcu seç');
  const playerId = cellCandidates(state, 0, 0)[0];
  await pages[actor].locator('#playerSearch').fill(football.players.find((p) => p.id === playerId).name);
  await click(actor, '[data-player="' + playerId + '"]');
  await until(async () => Boolean((await game()).picks['0-0']), 'football search after lol');
  assert.deepEqual(errors, []);
  console.log('PASS: switching back to football restores its search and game; zero browser exceptions');
} finally { await browser.close(); }
