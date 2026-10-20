import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const pages = [], errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) { const end = Date.now() + timeout; do { if (await check()) return; await pause(50); } while (Date.now() < end); throw new Error('Timeout: ' + label); }
const state = (n = 0) => pages[n].evaluate(() => currentGame);
const notes = () => Promise.all(pages.map(page => page.evaluate(() => window.__notes || 0)));
const join = async (n, code) => { await pages[n].locator('#joinNickname').fill('Oyuncu ' + n); await pages[n].locator('#joinCode').fill(code); await pages[n].locator('#joinPassword').fill('test'); await pages[n].locator('#joinForm button').click(); await until(() => pages[n].locator('#room').isVisible(), 'join ' + n); };
try {
  for (let n = 0; n < 4; n++) {
    const context = await browser.newContext();
    await context.addInitScript(() => { window.__notes = 0; const create = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__notes++; return create.call(this); }; });
    const page = await context.newPage(); pages.push(page); page.on('pageerror', error => errors.push(error.message)); await page.goto(base);
  }
  // Accent remains local and survives reload, including dark and bright choices.
  for (const color of ['#000000', '#ffffff', '#2455ed']) {
    await pages[0].locator('#accentColor').fill(color);
    assert.equal(await pages[0].evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), color);
    await pages[0].reload(); assert.equal(await pages[0].locator('#accentColor').inputValue(), color);
  }
  assert.equal(await pages[1].locator('#accentColor').inputValue(), '#f2cf43');
  // A private room never appears in the browser.
  await pages[2].locator('[data-tab="create"]').click();
  await pages[2].locator('#createNickname').fill('Private'); await pages[2].locator('#createPassword').fill('test'); await pages[2].locator('#listLobby').uncheck(); await pages[2].locator('#createForm button').click();
  await until(() => pages[2].locator('#room').isVisible(), 'private room');
  const privateCode = await pages[2].locator('#roomCodeLabel').innerText();
  assert.ok(!(await (await pages[0].request.get(base + '/api/rooms')).json()).rooms.some(room => room.code === privateCode));
  await pages[2].locator('#leaveRoom').click(); await pages[2].locator('[data-tab="join"]').click();
  await pages[0].locator('[data-tab="create"]').click(); await pages[0].locator('#createNickname').fill('Ada'); await pages[0].locator('#createPassword').fill('test'); await pages[0].locator('#createForm button').click();
  await until(() => pages[0].locator('#room').isVisible(), 'public room');
  const code = await pages[0].locator('#roomCodeLabel').innerText();
  await pages[1].locator('[data-tab="browse"]').click(); await until(() => pages[1].locator(`[data-lobby="${code}"]`).isVisible(), 'public listing');
  await pages[1].locator(`[data-lobby="${code}"]`).click(); assert.equal(await pages[1].locator('#joinCode').inputValue(), code);
  await pages[1].locator('#joinNickname').fill('Oyuncu 1'); await pages[1].locator('#joinPassword').fill('wrong'); await pages[1].locator('#joinForm button').click();
  await until(async () => (await pages[1].locator('#toast').innerText()).includes('şifresi yanlış'), 'password remains enforced');
  assert.equal(await pages[1].locator('#room').isVisible(), false);
  await join(1, code); await join(2, code); await join(3, code);
  const listed = (await (await pages[0].request.get(base + '/api/rooms')).json()).rooms.find(room => room.code === code);
  assert.equal(listed.playerCount, 4); assert.deepEqual(Object.keys(listed).sort(), ['code', 'full', 'game', 'playerCount']);
  const ids = await Promise.all(pages.map(page => page.evaluate(() => playerId)));
  for (const kind of ['xox', 'lol']) {
    const before = await notes(); await pages[0].locator(`[data-game="${kind}"]`).click();
    await until(async () => (await state(3))?.kind === (kind === 'xox' ? 'xox' : 'lol-xox'), 'start ' + kind);
    let game = await state(); await until(async () => (await notes()).every((count, n) => count === before[n] + (game.teams[game.turn].includes(ids[n]) ? 2 : 0)), 'own initial turn sound');
    const initial = await notes();
    await Promise.all(pages.map(page => page.evaluate(() => watchoutPreferences.notifyTurn(currentGame, playerId))));
    assert.deepEqual(await notes(), initial, 'duplicate render must not repeat sound');
    const actor = ids.indexOf(game.teams[game.turn][0]), oldTurn = game.turnId;
    await pages[actor].locator('[data-action="pass-xox"]').click();
    await until(async () => (await state(3)).turnId !== oldTurn, 'pass'); game = await state();
    await until(async () => (await notes()).every((count, n) => count === initial[n] + (game.teams[game.turn].includes(ids[n]) ? 2 : 0)), 'next team sound');
    // Muting persists and suppresses the next own-turn notification.
    for (const page of pages) await page.locator('#turnSound').click();
    const muted = await notes(), nextActor = ids.indexOf(game.teams[game.turn][0]), nextTurn = game.turnId;
    await pages[nextActor].locator('[data-action="pass-xox"]').click(); await until(async () => (await state(3)).turnId !== nextTurn, 'muted turn');
    assert.deepEqual(await notes(), muted);
    await pages[0].evaluate(() => send({ type: 'stop-game' })); await until(async () => (await state(3)) === null, 'stop game');
    for (const page of pages) await page.locator('#turnSound').click();
  }
  const mobile = pages[0]; await mobile.setViewportSize({ width: 390, height: 844 }); await mobile.locator('#leaveRoom').click(); await mobile.locator('[data-tab="browse"]').click();
  await mobile.locator('#accentColor').fill('#ce4aef'); await until(() => mobile.locator(`[data-lobby="${code}"]`).isVisible(), 'mobile list');
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await fs.mkdir('.cache/browser-results', { recursive: true }); await mobile.screenshot({ path: '.cache/browser-results/preferences-mobile.png', fullPage: true });
  for (let n = 1; n < 4; n++) await pages[n].locator('#leaveRoom').click();
  await until(async () => !(await (await mobile.request.get(base + '/api/rooms')).json()).rooms.some(room => room.code === code), 'empty lobby removed');
  await mobile.reload(); assert.equal(await mobile.locator('#accentColor').inputValue(), '#ce4aef');
  assert.deepEqual(errors, []);
  console.log('PASS: four browsers, private/public discovery, password gate, counts/removal, both XOX turn sounds, duplicate suppression, mute, persistent colors, mobile overflow.');
} finally { await browser.close(); }
