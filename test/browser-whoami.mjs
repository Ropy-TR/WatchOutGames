import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8787';
const pages = [], errors = [], frames = [[],[],[],[]];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve,ms));
async function until(check, label) {
  const end=Date.now()+10000;
  do { if(await check()) return; await pause(40); } while(Date.now()<end);
  throw new Error('Timeout: '+label);
}
const game=(n=0)=>pages[n].evaluate(()=>currentGame);
const click=(n,selector)=>pages[n].locator(selector).click();
async function assertPrivacy(ids) {
  const state=await game();
  for(let n=0;n<4;n++) {
    const other=(n+1)%4;
    const identity=await pages[other].locator('[data-who-player="'+ids[n]+'"] strong').innerText();
    assert.equal(await pages[n].locator('#whoOwnIdentity').innerText(),'???');
    assert.equal(await pages[n].locator('[data-who-player]').count(),3);
    for(const payload of frames[n].filter((message)=>message.type==='game'&&message.game?.gameId===state.gameId)) {
      assert.equal(payload.identityCards.find((card)=>card.id===ids[n]).identity,null);
      assert.ok(!JSON.stringify(payload).includes(identity));
    }
  }
}
try {
  for(let n=0;n<4;n++) {
    const context=await browser.newContext();const page=await context.newPage();pages.push(page);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('websocket',socket=>socket.on('framereceived',event=>{try{frames[n].push(JSON.parse(String(event.payload)));}catch{}}));
    await page.goto(base);
  }
  await click(0,'[data-tab="create"]');await pages[0].locator('#createNickname').fill('Ada');await pages[0].locator('#createPassword').fill('who-test');
  await click(0,'#createForm button');await until(()=>pages[0].locator('#room').isVisible(),'create');
  const code=await pages[0].locator('#roomCodeLabel').innerText();
  for(let n=1;n<4;n++) {
    await pages[n].locator('#joinNickname').fill('Oyuncu '+n);await pages[n].locator('#joinCode').fill(code);await pages[n].locator('#joinPassword').fill('who-test');
    await click(n,'#joinForm button');await until(()=>pages[n].locator('#room').isVisible(),'join');
  }
  const ids=await Promise.all(pages.map(page=>page.evaluate(()=>playerId)));
  assert.ok(await pages[0].locator('[data-game="whoami"]').isVisible());
  await click(0,'[data-game="whoami"]');
  assert.deepEqual(await pages[0].locator('#whoCategory option').allTextContents(),['Ünlüler','Meslekler','Karışık']);
  await click(0,'[data-action="start-whoami"]');await until(async()=>(await game(3))?.kind==='whoami','start');
  await assertPrivacy(ids);
  await pages[0].setViewportSize({width:390,height:844});
  assert.ok(await pages[0].evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await fs.mkdir('.cache/browser-results',{recursive:true});await pages[0].screenshot({path:'.cache/browser-results/whoami-mobile.png',fullPage:true});
  const original=await pages[0].evaluate(()=>whoCards);
  await pages[0].reload();
  await pages[0].locator('#joinNickname').fill('Ada');await pages[0].locator('#joinCode').fill(code);await pages[0].locator('#joinPassword').fill('who-test');
  await click(0,'#joinForm button');await until(async()=>(await game())?.kind==='whoami','reconnect');
  assert.deepEqual(await pages[0].evaluate(()=>whoCards),original);assert.equal(await pages[0].locator('#whoOwnIdentity').innerText(),'???');
  let state=await game(),actor=ids.indexOf(state.turn);
  const wrong=(actor+1)%4;
  assert.equal(await pages[wrong].locator('#whoGuessForm').count(),0);
  await pages[actor].locator('#whoGuess').fill('kesinlikle yanlış tahmin');await click(actor,'#whoGuessForm button');
  await until(async()=>(await game()).turnId!==state.turnId,'wrong guess passes');
  assert.equal((await game()).solved.length,0);assert.equal(await pages[actor].locator('#whoOwnIdentity').innerText(),'???');
  console.log('PASS: separate game card, celebrity category, personalized WebSocket privacy, reconnect, mobile and wrong-guess turn');
  for(let i=0;i<4;i++) {
    state=await game();actor=ids.indexOf(state.turn);
    const identity=await pages[(actor+1)%4].locator('[data-who-player="'+ids[actor]+'"] strong').innerText();
    await pages[actor].locator('#whoGuess').fill(identity);await click(actor,'#whoGuessForm button');
    await until(async()=>(await game()).solved.length===i+1,'correct identity');
    assert.equal(await pages[actor].locator('#whoOwnIdentity').innerText(),identity);
  }
  await until(async()=>(await game(3)).phase==='results','all solved');
  for(const category of ['Meslekler','Karışık']) {
    await pages[0].locator('#whoNextCategory').selectOption(category);await click(0,'[data-action="next-whoami"]');
    await until(async()=>(await game(3)).category===category&&(await game(3)).phase==='playing','new '+category);
    await assertPrivacy(ids);
    state=await game();actor=ids.indexOf(state.turn);await click(actor,'[data-action="pass-whoami"]');
    await until(async()=>(await game()).turnId!==state.turnId,'pass');
    await click(0,'[data-action="finish-whoami"]');await until(async()=>(await game()).phase==='results','manual finish');
    for(const page of pages)assert.notEqual(await page.locator('#whoOwnIdentity').innerText(),'???');
  }
  assert.equal((await game()).round,3);assert.deepEqual(errors,[]);
  await click(0,'[data-action="menu"]');await until(()=>pages[0].locator('[data-game="whoami"]').isVisible(),'return to menu');
  console.log('PASS: four correct guesses finish round, jobs/mixed categories, pass, manual reveal, new rounds and menu; zero browser exceptions');
} finally { await browser.close(); }
