import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium }=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.GAME_TEST_URL||'http://127.0.0.1:8787';
const pages=[],frames=[[],[],[],[]],errors=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label,timeout=10000){const end=Date.now()+timeout;do{if(await check())return;await pause(40);}while(Date.now()<end);throw new Error('Timeout: '+label);}
const game=(n=0)=>pages[n].evaluate(()=>currentGame),click=(n,s)=>pages[n].locator(s).click();
try{
  for(let n=0;n<4;n++){
    const context=await browser.newContext(),page=await context.newPage();pages.push(page);
    page.on('pageerror',error=>errors.push(error.message));page.on('websocket',socket=>socket.on('framereceived',event=>{try{frames[n].push(JSON.parse(String(event.payload)));}catch{}}));
    await page.goto(base);
  }
  await click(0,'[data-tab="create"]');await pages[0].locator('#createNickname').fill('Ada');await pages[0].locator('#createPassword').fill('tabu-test');await click(0,'#createForm button');await until(()=>pages[0].locator('#room').isVisible(),'create');
  const code=await pages[0].locator('#roomCodeLabel').innerText();
  for(let n=1;n<4;n++){await pages[n].locator('#joinNickname').fill('Oyuncu '+n);await pages[n].locator('#joinCode').fill(code);await pages[n].locator('#joinPassword').fill('tabu-test');await click(n,'#joinForm button');await until(()=>pages[n].locator('#room').isVisible(),'join');}
  const ids=await Promise.all(pages.map(page=>page.evaluate(()=>playerId)));
  await click(0,'[data-game="tabu"]');await until(async()=>(await game(3))?.phase==='lobby','lobby');
  assert.equal(await pages[0].locator('[data-tabu-team]').count(),2);
  await click(0,'[data-action="begin-tabu"]');await until(async()=>(await game(3))?.phase==='ready','ready');
  let state=await game(),actor=ids.indexOf(state.narrator),referee=ids.indexOf(state.referee);
  for(const page of pages)assert.equal(await page.locator('#tabuWord').count(),0);
  await click(actor,'[data-action="start-tabu-turn"]');await until(async()=>(await game(3)).phase==='playing','timer start');
  state=await game();const firstCard=await pages[actor].evaluate(()=>tabuCard);
  for(let n=0;n<4;n++){
    const visible=[actor,referee].includes(n);
    assert.equal(await pages[n].locator('#tabuWord').count(),visible?1:0);
    if(!visible)for(const payload of frames[n].filter(message=>message.type==='game'&&message.game?.phase==='playing')){
      assert.equal(payload.tabuCard,null);assert.ok(!JSON.stringify(payload).includes(firstCard.word));
    }
  }
  assert.equal(await pages[referee].locator('[data-tabu-action="correct"]').count(),0);
  await pages[actor].setViewportSize({width:390,height:844});assert.ok(await pages[actor].evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await fs.mkdir('.cache/browser-results',{recursive:true});await pages[actor].screenshot({path:'.cache/browser-results/tabu-mobile.png',fullPage:true});
  await click(actor,'[data-tabu-action="correct"]');await until(async()=>(await game()).scores[state.team]===1,'correct point');
  await until(async()=>(await pages[referee].evaluate(()=>tabuCard.id))!==firstCard.id,'referee synced card');
  await click(referee,'[data-tabu-action="tabu"]');await until(async()=>(await game()).scores[state.team]===0,'referee penalty');
  for(let i=0;i<3;i++){await click(actor,'[data-tabu-action="pass"]');await until(async()=>(await game()).stats.passes===i+1,'pass '+i);}
  assert.ok(await pages[actor].locator('[data-tabu-action="pass"]').isDisabled());
  const before=await pages[actor].evaluate(()=>tabuCard);
  await pages[actor].reload();await pages[actor].locator('#joinNickname').fill(actor===0?'Ada':'Oyuncu '+actor);await pages[actor].locator('#joinCode').fill(code);await pages[actor].locator('#joinPassword').fill('tabu-test');await click(actor,'#joinForm button');await until(async()=>(await game(actor))?.phase==='playing','rejoin narrator');
  assert.equal((await pages[actor].evaluate(()=>tabuCard)).id,before.id);assert.equal((await game()).deadline,state.deadline);
  console.log('PASS: separate Tabu menu, teams, narrator/referee-only cards, +1/-1 scores, three passes, reconnect and mobile');
  console.log('Waiting for actual 60-second server alarm...');
  await until(async()=>(await game()).phase==='between','real 60-second alarm',64000);
  for(const page of pages)assert.equal(await page.locator('#tabuWord').count(),0);
  assert.equal((await game()).history.length,1);assert.equal((await game()).history[0].points,0);
  await click(0,'[data-action="next-tabu-turn"]');await until(async()=>(await game(3)).phase==='ready','next team');
  assert.notEqual((await game()).team,state.team);assert.equal((await game()).scores[state.team],0);
  assert.deepEqual(errors,[]);
  await click(0,'[data-action="menu"]');await until(()=>pages[0].locator('[data-game="tabu"]').isVisible(),'return menu');
  console.log('PASS: real 60-second deadline, retired cards, preserved scoreboard, alternating team and menu; zero browser exceptions');
}finally{await browser.close();}
