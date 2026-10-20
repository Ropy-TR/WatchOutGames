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
test('Independent probability boundaries: side 90, top 70, countries 90, elite 80', () => {
  for (let ticket=0;ticket<100;ticket++) {
    const plan=(mode,tickets)=>drawFootballPlan(mode,()=>tickets.shift()??0);
    assert.equal(Boolean(plan('clubs',[0,ticket,0]).sideTurkish),ticket<90);
    assert.equal(Boolean(plan('clubs',[0,0,ticket]).topTurkish),ticket<70);
    assert.equal(Boolean(plan('countries',[0,ticket]).topTurkish),ticket<90);
    assert.equal(plan('clubs',[ticket,0,0]).profile==='elite',ticket<80);
    assert.equal(plan('clubs',[0,0,0,ticket]).sideTurkish.group==='big-four',ticket<95);
    assert.equal(plan('clubs',[0,0,0,0,0,ticket]).topTurkish.group==='big-four',ticket<95);
  }
});
test('Weighted draw never repeats or escapes supplied pool', () => {
  const pool=[...elite].slice(0,12);
  assert.deepEqual(sampleFootballClubs([...pool,...pool],15,()=>0),pool);
});
test('Two thousand mixed grids keep strict pools and independent Turkish axes', (t) => {
  for (const mode of ['clubs','countries']) {
    const random=rng();let eliteCount=0,left=0,top=0,both=0,leftBig=0,topBig=0;
    for (let i=0;i<1000;i++) {
      const board=createFootballBoard({mode},random);
      assert.ok(boardHasSolution(board));
      const topTr=board.topIds.filter(id=>turkish.has(id));
      const sideTr=board.sideIds.filter(id=>turkish.has(id));
      const ids=mode==='clubs'?[...board.topIds,...board.sideIds]:board.topIds;
      assert.equal(new Set(ids).size,ids.length);
      assert.ok(topTr.length<=1);assert.ok(sideTr.length<=1);
      if(mode==='countries') assert.equal(sideTr.length,0);
      const pool=board.selectionProfile==='elite'?elite:preferred;
      for(const id of ids) {assert.ok(preferred.has(id));assert.ok(turkish.has(id)||pool.has(id));}
      eliteCount+=board.selectionProfile==='elite';left+=sideTr.length;top+=topTr.length;
      both+=Boolean(topTr.length&&sideTr.length);leftBig+=four.has(sideTr[0]);topBig+=four.has(topTr[0]);
    }
    assert.ok(eliteCount>740&&eliteCount<860);
    if(mode==='clubs') {
      assert.ok(left>850&&left<950);assert.ok(top>640&&top<760);assert.ok(both>560&&both<700);
      assert.ok(leftBig/left>0.90&&leftBig/left<0.99);
    } else assert.ok(top>850&&top<950);
    assert.ok(topBig/top>0.90&&topBig/top<0.99);
    t.diagnostic(mode+': elite '+eliteCount+', side '+left+', top '+top+', both '+both+' /1000');
  }
});
test('Every combination of independent flags and Turkish groups produces a solvable grid', () => {
  for(const side of [false,true])for(const top of [false,true])for(const sideBig of [false,true])for(const topBig of [false,true]) {
    const tickets=[0,side?0:99,top?0:99];
    if(side)tickets.push(sideBig?0:99,1);
    if(top)tickets.push(topBig?0:99,2);
    const random=rng(1234);
    const board=createFootballBoard({mode:'clubs'},max=>tickets.length?tickets.shift():random(max));
    const trLeft=board.sideIds.filter(id=>turkish.has(id)),trTop=board.topIds.filter(id=>turkish.has(id));
    assert.equal(trLeft.length,Number(side));assert.equal(trTop.length,Number(top));
    if(side){assert.equal(four.has(trLeft[0]),sideBig);assert.equal(board.sideIds[1],trLeft[0]);}
    if(top){assert.equal(four.has(trTop[0]),topBig);assert.equal(board.topIds[2],trTop[0]);}
    assert.ok(boardHasSolution(board));
  }
});
test('Five hundred Super Lig grids contain six distinct domestic clubs and nine answers', () => {
  const random=rng();
  for(let i=0;i<500;i++) {
    const board=createFootballBoard({mode:'superlig'},random);
    assert.equal(board.mode,'superlig');assert.equal(board.selectionProfile,'superlig');
    const ids=[...board.topIds,...board.sideIds];assert.equal(new Set(ids).size,6);
    for(const id of ids)assert.ok(turkish.has(id));assert.ok(boardHasSolution(board));
    if(i===0){
      assert.equal(createFootballBoard({mode:'superlig',topIds:board.topIds,sideIds:board.sideIds},random).mode,'superlig');
      assert.throws(()=>createFootballBoard({mode:'superlig',topIds:['Q8682',...board.topIds.slice(1)],sideIds:board.sideIds},random));
      assert.throws(()=>createFootballBoard({mode:'superlig',topIds:board.topIds,sideIds:[board.topIds[0],...board.sideIds.slice(1)]},random));
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
