import { TABU_CARDS } from './tabu-data.js';
import { secureIndex, shuffled } from './game-rules.js';

export const TABU_DURATION = 60;
export const TABU_ROUNDS = 3;
export const TABU_PASSES = 3;
const opposite = (team) => team === 'red' ? 'blue' : 'red';
export function createTabuLobby(members) {
  if (members.length < 4 || members.length > 8) throw new Error('Tabu için 4–8 oyuncu gerekli.');
  return { kind: 'tabu', gameId: crypto.randomUUID(), phase: 'lobby', assignments: Object.fromEntries(members.map((member,i) => [member.id, i % 2 ? 'blue' : 'red'])) };
}
export function joinTabuTeam(game, id, team) {
  if (game.phase !== 'lobby' || !['red','blue'].includes(team)) throw new Error('Takım seçilemedi.');
  game.assignments[id] = team;
}
export function beginTabu(game, members, random = secureIndex) {
  if (game.phase !== 'lobby') throw new Error('Maç zaten başladı.');
  if (members.length < 4) throw new Error('Tabu için en az 4 bağlı oyuncu gerekli.');
  const assignments = Object.fromEntries(members.filter((member) => ['red','blue'].includes(game.assignments[member.id])).map((member) => [member.id,game.assignments[member.id]]));
  for (const member of members) if (!assignments[member.id]) {
    const red = Object.values(assignments).filter((team) => team === 'red').length;
    assignments[member.id] = red <= Object.values(assignments).length - red ? 'red' : 'blue';
  }
  const teams = Object.fromEntries(['red','blue'].map((team) => [team,members.filter((member) => assignments[member.id] === team).map((member) => member.id)]));
  if (teams.red.length < 2 || teams.blue.length < 2) throw new Error('Her takımda en az iki oyuncu olmalı.');
  Object.assign(game, { assignments, teams, names: Object.fromEntries(members.map((member) => [member.id,member.nickname])),
    participants: members.map((member) => member.id), scores: {red:0,blue:0}, completed: {red:0,blue:0}, cursors: {red:0,blue:0}, history: [],
    team: random(2) ? 'blue' : 'red', deck: shuffled(TABU_CARDS.map((_,i)=>i),random), position:0 });
  prepareTabuTurn(game,new Set(game.participants));
}
function prepareTabuTurn(game, connected) {
  const choose = (team) => {
    const ids=game.teams[team];
    for(let step=0;step<ids.length;step++) {const id=ids[(game.cursors[team]+step)%ids.length];if(connected.has(id))return id;}
    return ids[game.cursors[team]%ids.length];
  };
  Object.assign(game,{phase:'ready',round:game.completed[game.team]+1,narrator:choose(game.team),referee:choose(opposite(game.team)),
    turnId:crypto.randomUUID(),deadline:null,card:null,turnLog:[],stats:{correct:0,tabu:0,passes:0}});
}
function drawCard(game, random=secureIndex) {
  if(game.position>=game.deck.length) {game.deck=shuffled(TABU_CARDS.map((_,i)=>i),random);game.position=0;}
  game.card={id:crypto.randomUUID(),index:game.deck[game.position++]};
}
export function startTabuTurn(game, id, now=Date.now()) {
  if(game.phase!=='ready'||game.narrator!==id)throw new Error('Turu anlatıcı başlatmalı.');
  game.phase='playing';game.deadline=now+TABU_DURATION*1000;drawCard(game);
}
export function finishTabuTurn(game) {
  if(game.phase!=='playing')return false;
  if(game.card)game.turnLog.push({word:TABU_CARDS[game.card.index].word,result:'time'});
  game.history.push({team:game.team,narrator:game.narrator,round:game.round,points:game.stats.correct-game.stats.tabu,stats:{...game.stats},cards:game.turnLog});
  game.completed[game.team]++;
  game.cursors[game.team]=(game.teams[game.team].indexOf(game.narrator)+1)%game.teams[game.team].length;
  game.card=null;game.deadline=null;
  if(game.completed.red>=TABU_ROUNDS&&game.completed.blue>=TABU_ROUNDS) {
    game.phase='results';game.winner=game.scores.red===game.scores.blue?'draw':game.scores.red>game.scores.blue?'red':'blue';
  } else game.phase='between';
  return true;
}
export function expireTabu(game, now=Date.now()) {
  return game.phase==='playing'&&now>=game.deadline?finishTabuTurn(game):false;
}
export function nextTabuTurn(game, connected) {
  if(game.phase!=='between')throw new Error('Sonraki tur başlatılamaz.');
  if(Object.values(game.teams).some((ids)=>!ids.some((id)=>connected.has(id))))throw new Error('İki takımdan da en az bir oyuncu bağlı olmalı.');
  game.team=opposite(game.team);prepareTabuTurn(game,connected);
}
export function claimTabuRole(game,id,role,connected) {
  if(!['ready','playing'].includes(game.phase)||!['narrator','referee'].includes(role))throw new Error('Görev devralınamaz.');
  const eligible=role==='narrator'?game.teams[game.team]:game.teams[opposite(game.team)];
  if(!eligible.includes(id)||connected.has(game[role]))throw new Error('Görevdeki oyuncu bağlı veya takımın uygun değil.');
  game[role]=id;
}
export function tabuAction(game,id,action,cardId,now=Date.now()) {
  if(game.phase!=='playing'||now>=game.deadline||game.card?.id!==cardId)throw new Error('Kart veya süre değişti.');
  if(!['correct','pass','tabu'].includes(action))throw new Error('Geçersiz işlem.');
  const allowed=action==='tabu'?[game.narrator,game.referee].includes(id):id===game.narrator;
  if(!allowed)throw new Error('Bu işlemi yapamazsın.');
  if(action==='pass'&&game.stats.passes>=TABU_PASSES)throw new Error('Üç pas hakkın doldu.');
  const result=action==='pass'?'passes':action;
  game.stats[result]++;
  if(action==='correct')game.scores[game.team]++;
  if(action==='tabu')game.scores[game.team]--;
  game.turnLog.push({word:TABU_CARDS[game.card.index].word,result:action});drawCard(game);
}
export function tabuView(game,members=[]) {
  if(game.phase==='lobby')return {kind:game.kind,gameId:game.gameId,phase:game.phase,assignments:game.assignments,names:Object.fromEntries(members.map((member)=>[member.id,member.nickname]))};
  return {kind:game.kind,gameId:game.gameId,phase:game.phase,assignments:game.assignments,teams:game.teams,names:game.names,participants:game.participants,
    scores:game.scores,completed:game.completed,team:game.team,narrator:game.narrator,referee:game.referee,round:game.round,turnId:game.turnId,deadline:game.deadline,
    stats:game.stats,rounds:TABU_ROUNDS,duration:TABU_DURATION,maxPasses:TABU_PASSES,winner:game.winner,
    ...(game.phase==='between'||game.phase==='results'?{history:game.history}:{} )};
}
export function privateTabuCard(game,id) {
  if(game.phase!=='playing'||![game.narrator,game.referee].includes(id))return null;
  const card=TABU_CARDS[game.card.index];return {id:game.card.id,word:card.word,banned:card.banned};
}
