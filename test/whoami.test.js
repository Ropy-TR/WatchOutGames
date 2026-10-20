import test from 'node:test';
import assert from 'node:assert/strict';
import { WHO_CATEGORIES, createWhoami, whoamiView, whoamiCards, guessWhoami } from '../src/whoami.js';
import { roomHarness } from './room-harness.js';
import worker from '../src/worker.js';

test('Who am I pools have familiar celebrities, varied jobs and no duplicate cards', () => {
  assert.ok(WHO_CATEGORIES['Ünlüler'].length >= 100);
  assert.ok(WHO_CATEGORIES['Meslekler'].length >= 60);
  for (const cards of Object.values(WHO_CATEGORIES)) {
    assert.equal(new Set(cards.map((card) => card[0])).size,cards.length);
    assert.ok(cards.every((card) => card.every((alias) => typeof alias === 'string' && alias.trim())));
  }
  for (const name of ['Kemal Sunal','Cem Yılmaz','Tarkan','Lionel Messi','Michael Jackson','Brad Pitt']) assert.ok(WHO_CATEGORIES['Ünlüler'].some((card) => card[0] === name));
});
test('Assignments are unique for 2–8 players; each round is a fresh secure draw', () => {
  for (let count=2;count<=8;count++) {
    const members=Array.from({length:count},(_,n)=>({id:'p'+n,nickname:'P'+n}));
    for(const category of Object.keys(WHO_CATEGORIES)) {
      const game=createWhoami(members,category);
      assert.equal(new Set(Object.values(game.identities).map((card)=>card.name)).size,count);
      assert.ok(game.participants.includes(game.turn));assert.equal(game.category,category);
    }
  }
  assert.throws(()=>createWhoami([{id:'one',nickname:'One'}]));
  assert.equal(createWhoami([{id:'a'},{id:'b'}],'__proto__').category,'Ünlüler');
});
test('Shared state never contains identities; personalized cards hide only the viewer', () => {
  const game=createWhoami([{id:'a',nickname:'A'},{id:'b',nickname:'B'}]);
  const view=whoamiView(game);assert.equal(view.identities,undefined);
  for(const id of game.participants) assert.ok(!JSON.stringify(view).includes(game.identities[id].name));
  assert.equal(whoamiCards(game,'a').find((card)=>card.id==='a').identity,null);
  assert.equal(whoamiCards(game,'a').find((card)=>card.id==='b').identity,game.identities.b.name);
  assert.ok(whoamiCards(game,'spectator').every((card)=>card.identity));
});
test('Correct aliases ignore Turkish accents and punctuation, reveal solved self and finish all-solved round', () => {
  const game=createWhoami([{id:'a',nickname:'A'},{id:'b',nickname:'B'}]);
  game.turn='a';game.identities.a={name:'Kıvanç Tatlıtuğ',aliases:['Kıvanç Tatlıtuğ']};
  assert.equal(guessWhoami(game,'a',' KIVANC TATLITUG! ',new Set(['a','b'])),true);
  assert.deepEqual(game.solved,['a']);assert.equal(game.turn,'b');
  assert.equal(whoamiCards(game,'a').find((card)=>card.id==='a').identity,'Kıvanç Tatlıtuğ');
  assert.ok(guessWhoami(game,'b',game.identities.b.aliases[0],new Set(['a','b'])));
  assert.equal(game.phase,'results');assert.equal(game.turn,null);
  assert.ok(whoamiCards(game,'a').every((card)=>card.identity));
});
test('Wrong guess passes turn without revealing the answer; empty/out-of-turn guesses are rejected', () => {
  const game=createWhoami([{id:'a',nickname:'A'},{id:'b',nickname:'B'}]);game.turn='a';
  assert.throws(()=>guessWhoami(game,'b','anything',new Set(['a','b'])));
  assert.throws(()=>guessWhoami(game,'a','  ',new Set(['a','b'])));
  assert.equal(guessWhoami(game,'a','Definitely wrong',new Set(['a','b'])),false);
  assert.equal(game.turn,'b');assert.equal(game.solved.length,0);
  assert.equal(whoamiCards(game,'a').find((card)=>card.id==='a').identity,null);
});
test('Room join and broadcasts keep own identity secret; reconnect preserves assignment', async () => {
  const h=await roomHarness(4);await h.send(0,{type:'start-whoami',category:'Ünlüler'});
  const game=h.game;
  assert.equal(h.room.publicRoom(h.state.get('room')).game.identities,undefined);
  for(let n=0;n<4;n++) {
    const payload=h.last(n);
    assert.equal(payload.identityCards.find((card)=>card.id===h.ids[n]).identity,null);
    assert.ok(!JSON.stringify(payload).includes(game.identities[h.ids[n]].name));
    assert.equal(payload.identityCards.filter((card)=>card.identity).length,3);
  }
  const socket=h.socket(), member=h.state.get('room').members[0];
  await h.send(socket,{type:'join',password:'test',nickname:'Rejoined',playerId:member.id,sessionToken:member.token});
  assert.equal(h.game.identities[member.id].name,game.identities[member.id].name);
  const joined=socket.messages.find((m)=>m.type==='joined');
  assert.ok(!JSON.stringify(joined).includes(game.identities[member.id].name));
  assert.equal(socket.messages.filter((m)=>m.type==='game').at(-1).identityCards.find((card)=>card.id===member.id).identity,null);
});
test('Server rejects stale turns, spectators and simultaneous duplicate guesses', async () => {
  const h=await roomHarness(4);await h.send(0,{type:'start-whoami',category:'Meslekler'});
  const game=h.game, actor=h.ids.indexOf(game.turn);
  const packet={type:'guess-whoami',gameId:game.gameId,turnId:game.turnId,guess:game.identities[game.turn].aliases[0]};
  await h.send(actor,{...packet,turnId:'old'});assert.equal(h.game.solved.length,0);
  const late=h.socket();await h.send(late,{type:'join',password:'test',nickname:'Late'});
  await h.send(late,packet);assert.equal(h.game.solved.length,0);
  await Promise.all([h.send(actor,packet),h.send(actor,packet)]);
  assert.deepEqual(h.game.solved,[game.turn]);
  await h.send(late,{type:'finish-whoami',gameId:game.gameId});assert.equal(h.game.phase,'playing');
});
test('Offline turn can be skipped and results expose answers; next round includes new players', async () => {
  const h=await roomHarness(3);await h.send(0,{type:'start-whoami',category:'Meslekler'});
  const game=h.game, actor=h.ids.indexOf(game.turn), other=(actor+1)%3;
  await h.send(other,{type:'pass-whoami',gameId:game.gameId,turnId:game.turnId});assert.equal(h.game.turnId,game.turnId);
  h.sockets[actor].readyState=3;await h.room.onClose(h.sockets[actor]);
  await h.send(other,{type:'pass-whoami',gameId:game.gameId,turnId:game.turnId});assert.notEqual(h.game.turn,game.turn);
  await h.send(other,{type:'finish-whoami',gameId:game.gameId});assert.equal(h.game.phase,'results');
  assert.ok(h.last(other).identityCards.every((card)=>card.identity));
  const late=h.socket();await h.send(late,{type:'join',password:'test',nickname:'Late'});
  const before=h.game;await h.send(other,{type:'next-whoami',gameId:before.gameId,category:'Karışık'});
  assert.equal(h.game.round,2);assert.equal(h.game.category,'Karışık');assert.equal(h.game.participants.length,3);
  assert.equal(h.game.solved.length,0);assert.notEqual(h.game.gameId,before.gameId);
  await h.send(other,{type:'finish-whoami',gameId:before.gameId});assert.equal(h.game.phase,'playing');
});
test('Catalog advertises Who am I separately and returns category names without identity pool', async () => {
  const response=await worker.fetch(new Request('https://example.test/api/games'),{});const catalog=await response.json();
  assert.ok(catalog.games.includes('whoami'));assert.deepEqual(catalog.whoamiCategories,Object.keys(WHO_CATEGORIES));
  assert.ok(!JSON.stringify(catalog).includes('Kemal Sunal'));
});
