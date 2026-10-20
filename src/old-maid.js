import { secureIndex, shuffled } from './game-rules.js';
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q'];
const SUITS = ['♠','♥','♦','♣'];
export function createOldMaid(members) {
  return { kind:'old-maid',gameId:crypto.randomUUID(),phase:'lobby',names:Object.fromEntries(members.map(member=>[member.id,member.nickname])),participants:[],hands:{},finished:[],pairs:0,turn:null,source:null,turnId:null,deadline:null,offer:[],lastDraw:null,loser:null };
}
function discardPairs(game,id){
  const hand=game.hands[id], keep=[], ranks=new Map();
  for(const card of hand){if(!ranks.has(card.rank))ranks.set(card.rank,[]);ranks.get(card.rank).push(card);}
  let pairs=0;
  for(const cards of ranks.values()){pairs+=Math.floor(cards.length/2);if(cards.length%2)keep.push(cards.at(-1));}
  game.hands[id]=shuffled(keep);game.pairs+=pairs;
  if(!keep.length&&!game.finished.includes(id))game.finished.push(id);
  return pairs;
}
function nextTurn(game,after,now){
  const active=game.participants.filter(id=>game.hands[id].length);
  if(active.length===1){game.phase='results';game.loser=active[0];game.turn=null;game.source=null;game.deadline=null;game.offer=[];return;}
  let index=after===null?-1:game.participants.indexOf(after), next=null;
  for(let n=1;n<=game.participants.length;n++){const id=game.participants[(index+n)%game.participants.length];if(game.hands[id].length){next=id;break;}}
  game.turn=next;
  const turnIndex=game.participants.indexOf(next);
  for(let n=1;n<game.participants.length;n++){const id=game.participants[(turnIndex+n)%game.participants.length];if(game.hands[id].length){game.source=id;break;}}
  game.offer=shuffled(game.hands[game.source].map(card=>card.id));
  game.turnId=crypto.randomUUID();game.deadline=now+30000;
}
export function beginOldMaid(game,members,now=Date.now()){
  if(game.phase!=='lobby'||members.length<2||members.length>8)throw new Error('Papaz Kimde için 2–8 bağlı oyuncu gerekli.');
  game.participants=shuffled(members.map(member=>member.id));game.names=Object.fromEntries(members.map(member=>[member.id,member.nickname]));
  const deck=shuffled([...RANKS.flatMap(rank=>SUITS.map(suit=>({id:crypto.randomUUID(),rank,suit}))),{id:crypto.randomUUID(),rank:'K',suit:'♠'}]);
  for(const id of game.participants)game.hands[id]=[];
  deck.forEach((card,index)=>game.hands[game.participants[index%game.participants.length]].push(card));
  for(const id of game.participants)discardPairs(game,id);
  game.phase='playing';nextTurn(game,null,now);
}
export function drawOldMaid(game,id,msg,now=Date.now(),automatic=false){
  if(game.phase!=='playing'||game.turn!==id||msg.turnId!==game.turnId||(!automatic&&now>=game.deadline))throw new Error('Sıra değişti veya sıra sende değil.');
  if(!Number.isInteger(msg.index)||msg.index<0||msg.index>=game.offer.length)throw new Error('Geçersiz kart.');
  const source=game.source, cardId=game.offer[msg.index], card=game.hands[source].find(card=>card.id===cardId);
  if(!card)throw new Error('Kart sırası yenilendi.');
  game.hands[source]=game.hands[source].filter(card=>card.id!==cardId);game.hands[id].push(card);
  const pairs=discardPairs(game,id);
  if(!game.hands[source].length&&!game.finished.includes(source))game.finished.push(source);
  game.lastDraw={player:id,source,paired:pairs>0,automatic};
  nextTurn(game,id,now);
}
export function expireOldMaid(game,now=Date.now()){
  if(game.phase!=='playing'||now<game.deadline)return false;
  drawOldMaid(game,game.turn,{turnId:game.turnId,index:secureIndex(game.offer.length)},now,true);return true;
}
export function oldMaidPresence(game,connected,now=Date.now()){
  const online=game.participants.some(id=>connected.has(id));
  if(game.phase==='playing'&&!online){game.phase='paused';game.remaining=Math.max(1000,game.deadline-now);game.deadline=null;}
  else if(game.phase==='paused'&&online){game.phase='playing';game.deadline=now+game.remaining;delete game.remaining;}
}
export function oldMaidView(game){return {kind:game.kind,gameId:game.gameId,phase:game.phase,names:game.names,participants:game.participants,counts:Object.fromEntries(game.participants.map(id=>[id,game.hands[id].length])),finished:game.finished,pairs:game.pairs,turn:game.turn,source:game.source,turnId:game.turnId,deadline:game.deadline,serverTime:Date.now(),offerCount:game.offer.length,lastDraw:game.lastDraw,loser:game.loser};}
export function oldMaidPrivate(game,id){return game.participants.includes(id)?{cards:game.hands[id]}:null;}
