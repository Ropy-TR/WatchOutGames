import test from 'node:test';
import assert from 'node:assert/strict';
import { TABU_CARDS } from '../src/tabu-data.js';
import { createTabuLobby, beginTabu, joinTabuTeam, startTabuTurn, tabuAction, tabuView, privateTabuCard, expireTabu, nextTabuTurn, claimTabuRole } from '../src/tabu.js';
import { roomHarness } from './room-harness.js';
import worker from '../src/worker.js';

const members=Array.from({length:5},(_,i)=>({id:'p'+i,nickname:'Player '+i}));
const create=(count=4)=>{const game=createTabuLobby(members.slice(0,count));beginTabu(game,members.slice(0,count));return game;};
const connected=(game)=>new Set(game.participants);
test('Tabu deck has at least 250 unique original words, each with five distinct forbidden clues',()=>{
  assert.ok(TABU_CARDS.length>=250);
  assert.equal(new Set(TABU_CARDS.map(card=>card.word)).size,TABU_CARDS.length);
  for(const card of TABU_CARDS){assert.equal(card.banned.length,5);assert.equal(new Set(card.banned).size,5);assert.ok(!card.banned.includes(card.word));assert.ok(card.banned.every(word=>word.trim()));}
});
test('Tabu requires four players, auto balances five, and rejects insufficient teams atomically',()=>{
  assert.throws(()=>createTabuLobby(members.slice(0,3)));
  const game=create(5);assert.deepEqual([game.teams.red.length,game.teams.blue.length].sort(),[2,3]);
  const lobby=createTabuLobby(members.slice(0,4));joinTabuTeam(lobby,'p3','red');
  assert.throws(()=>beginTabu(lobby,members.slice(0,4)));assert.equal(lobby.phase,'lobby');assert.equal(lobby.scores,undefined);
  joinTabuTeam(lobby,'p3','blue');beginTabu(lobby,members.slice(0,4));assert.equal(lobby.phase,'ready');
});
test('No card before timer; narrator and opposite-team referee alone receive current card',()=>{
  const game=create();assert.equal(privateTabuCard(game,game.narrator),null);
  assert.ok(!game.teams[game.team].includes(game.referee));
  assert.throws(()=>startTabuTurn(game,game.referee));
  startTabuTurn(game,game.narrator,1000);assert.equal(game.deadline,61000);
  const card=privateTabuCard(game,game.narrator);assert.deepEqual(privateTabuCard(game,game.referee),card);
  for(const id of game.participants.filter(id=>![game.narrator,game.referee].includes(id)))assert.equal(privateTabuCard(game,id),null);
  assert.equal(privateTabuCard(game,'spectator'),null);
  const publicState=JSON.stringify(tabuView(game));assert.ok(!publicState.includes(card.word));assert.equal(tabuView(game).deck,undefined);assert.equal(tabuView(game).card,undefined);
});
test('Correct +1, referee tabu -1, three free passes and actor/card guards work',()=>{
  const game=create();startTabuTurn(game,game.narrator,1000);const team=game.team;
  const action=(actor,kind)=>tabuAction(game,actor,kind,game.card.id,2000);
  const guesser=game.teams[team].find(id=>id!==game.narrator);
  assert.throws(()=>action(guesser,'correct'));assert.throws(()=>action(guesser,'tabu'));assert.throws(()=>action(game.referee,'pass'));
  const old=game.card.id;action(game.narrator,'correct');assert.equal(game.scores[team],1);
  assert.throws(()=>tabuAction(game,game.narrator,'correct',old,2000));
  action(game.referee,'tabu');assert.equal(game.scores[team],0);
  for(let i=0;i<3;i++)action(game.narrator,'pass');assert.equal(game.stats.passes,3);
  assert.throws(()=>action(game.narrator,'pass'));assert.equal(game.scores[team],0);
  action(game.narrator,'tabu');assert.equal(game.scores[team],-1);
});
test('Cards do not repeat until the full deck is consumed, then a new shuffled cycle begins',()=>{
  const game=create();startTabuTurn(game,game.narrator,1000);const seen=new Set();
  for(let i=0;i<TABU_CARDS.length;i++){assert.ok(!seen.has(game.card.index));seen.add(game.card.index);tabuAction(game,game.narrator,'correct',game.card.id,2000);}
  assert.equal(seen.size,TABU_CARDS.length);assert.ok(privateTabuCard(game,game.narrator));
});
test('Exactly 60 seconds expire once; late answers never score and retired words appear only after turn',()=>{
  const game=create();startTabuTurn(game,game.narrator,1000);const word=privateTabuCard(game,game.narrator).word;
  assert.equal(expireTabu(game,60999),false);assert.throws(()=>tabuAction(game,game.narrator,'correct',game.card.id,61000));
  assert.equal(expireTabu(game,61000),true);assert.equal(game.phase,'between');assert.equal(expireTabu(game,62000),false);
  assert.equal(game.history.length,1);assert.equal(game.history[0].cards[0].word,word);assert.equal(privateTabuCard(game,game.narrator),null);
});
test('Teams alternate and narrators rotate; six timed turns yield equal opportunities and a winner',()=>{
  const game=create(),first=game.team,narrators={red:[],blue:[]};
  for(let i=0;i<6;i++){
    assert.equal(game.team,i%2===0?first:first==='red'?'blue':'red');narrators[game.team].push(game.narrator);
    startTabuTurn(game,game.narrator,1000);
    if(game.team===first)tabuAction(game,game.narrator,'correct',game.card.id,2000);
    expireTabu(game,61000);
    if(i<5)nextTabuTurn(game,connected(game));
  }
  assert.deepEqual(game.completed,{red:3,blue:3});assert.equal(game.phase,'results');assert.equal(game.winner,first);
  assert.notEqual(narrators.red[0],narrators.red[1]);assert.notEqual(narrators.blue[0],narrators.blue[1]);
  assert.throws(()=>nextTabuTurn(game,connected(game)));
});
test('Disconnected roles can be claimed only by the appropriate team',()=>{
  const game=create();startTabuTurn(game,game.narrator);const online=connected(game),actor=game.teams[game.team].find(id=>id!==game.narrator);
  assert.throws(()=>claimTabuRole(game,actor,'narrator',online));online.delete(game.narrator);
  assert.throws(()=>claimTabuRole(game,game.referee,'narrator',online));claimTabuRole(game,actor,'narrator',online);assert.equal(game.narrator,actor);
  const other=game.participants.find(id=>game.assignments[id]!==game.team&&id!==game.referee);online.delete(game.referee);
  claimTabuRole(game,other,'referee',online);assert.equal(game.referee,other);
});
test('Room joins and broadcasts never leak cards to guessers, reconnect preserves card and deadline',async()=>{
  const h=await roomHarness(4);await h.send(0,{type:'start-tabu'});await h.send(0,{type:'begin-tabu',gameId:h.game.gameId});
  const narrator=h.ids.indexOf(h.game.narrator);await h.send(narrator,{type:'start-tabu-turn',gameId:h.game.gameId,turnId:h.game.turnId});
  const game=h.game,word=privateTabuCard(game,game.narrator).word;
  assert.ok(!JSON.stringify(h.room.publicRoom(h.state.get('room'))).includes(word));
  for(let i=0;i<4;i++)assert.equal(Boolean(h.last(i).tabuCard),[game.narrator,game.referee].includes(h.ids[i]));
  const late=h.socket();await h.send(late,{type:'join',password:'test',nickname:'Late'});assert.ok(!JSON.stringify(late.messages).includes(word));
  await h.send(late,{type:'tabu-card-action',gameId:game.gameId,turnId:game.turnId,cardId:game.card.id,action:'correct'});assert.equal(h.game.scores[game.team],0);
  const socket=h.socket(),member=h.state.get('room').members[narrator];
  await h.send(socket,{type:'join',password:'test',nickname:'Rejoined',playerId:member.id,sessionToken:member.token});
  assert.equal(h.game.deadline,game.deadline);assert.equal(socket.messages.filter(msg=>msg.type==='game').at(-1).tabuCard.word,word);
});
test('Concurrent duplicate card actions score once and alarms reject stale messages',async()=>{
  const h=await roomHarness(4);await h.send(0,{type:'start-tabu'});await h.send(0,{type:'begin-tabu',gameId:h.game.gameId});
  const actor=h.ids.indexOf(h.game.narrator);await h.send(actor,{type:'start-tabu-turn',gameId:h.game.gameId,turnId:h.game.turnId});
  const game=h.game,msg={type:'tabu-card-action',gameId:game.gameId,turnId:game.turnId,cardId:game.card.id,action:'correct'};
  await Promise.all([h.send(actor,msg),h.send(actor,msg)]);assert.equal(h.game.scores[game.team],1);
  const timed=h.game;timed.deadline=Date.now()-1;h.setGame(timed);await h.room.alarm();await h.send(actor,{...msg,cardId:timed.card.id});
  assert.equal(h.game.phase,'between');assert.equal(h.game.scores[game.team],1);assert.equal(h.game.history.length,1);
  await h.room.alarm();assert.equal(h.game.history.length,1);
});
test('Tabu is advertised as a separate game without disclosing its deck',async()=>{
  const response=await worker.fetch(new Request('https://example.test/api/games'),{});const value=await response.json();
  assert.ok(value.games.includes('tabu'));assert.equal(value.tabuCards,undefined);
});
