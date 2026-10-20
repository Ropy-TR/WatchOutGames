import { shuffled, secureIndex } from './game-rules.js';
import { DRAW_CATEGORIES, drawingPool, normalizeDrawingWord } from './drawing-words.js';
export { DRAW_CATEGORIES };
export const INK_COLORS=['#111827','#ffffff','#ef4444','#f97316','#facc15','#84cc16','#22c55e','#14b8a6','#38bdf8','#2563eb','#a855f7','#ec4899','#a16207','#9ca3af'];
export const INK_WIDTHS=[2,5,10,18,28];
export function createDrawing(members){return {kind:'drawing',gameId:crypto.randomUUID(),phase:'lobby',category:'general',laps:2,duration:90,participants:[],names:Object.fromEntries(members.map(member=>[member.id,member.nickname])),scores:{},order:[],round:0,drawer:null,turnId:null,deadline:null,startedAt:null,choices:[],word:null,used:[],guessed:{},chat:[],strokes:[],pointCount:0,canvasRev:0,history:[],lastGuess:{},hintCount:0,hintPositions:[],nextHintAt:null};}
export function configureDrawing(game,msg){
  if(game.phase!=='lobby')throw new Error('Maç başladı.');
  if(!DRAW_CATEGORIES.some(category=>category.id===msg.category)||![1,2,3].includes(msg.laps)||![60,90,120].includes(msg.duration))throw new Error('Geçersiz çizim ayarı.');
  game.category=msg.category;game.laps=msg.laps;game.duration=msg.duration;
}
function prepareRound(game,now){
  if(game.round>=game.order.length){game.phase='results';game.deadline=null;game.drawer=null;const best=Math.max(...Object.values(game.scores));game.winners=game.participants.filter(id=>game.scores[id]===best);return;}
  game.drawer=game.order[game.round++];game.turnId=crypto.randomUUID();game.phase='choosing';game.deadline=now+15000;
  game.word=null;game.guessed={};game.strokes=[];game.canvasRev=0;game.pointCount=0;game.hintCount=0;game.nextHintAt=null;game.lastGuess={};game.drawerOfflineAt=null;game.noGuessersAt=null;
  const pool=drawingPool(game.category), unused=pool.filter(word=>!game.used.includes(word.id));
  game.choices=shuffled(unused.length>=3?unused:pool).slice(0,3);
}
export function beginDrawing(game,members,now=Date.now()){
  if(game.phase!=='lobby'||members.length<2||members.length>8)throw new Error('Çiz & Tahmin Et için 2–8 bağlı oyuncu gerekli.');
  game.participants=members.map(member=>member.id);game.names=Object.fromEntries(members.map(member=>[member.id,member.nickname]));
  game.scores=Object.fromEntries(game.participants.map(id=>[id,0]));
  game.order=Array.from({length:game.laps},()=>shuffled(game.participants)).flat();prepareRound(game,now);
}
export function chooseDrawingWord(game,id,msg,now=Date.now()){
  if(game.phase!=='choosing'||id!==game.drawer||msg.turnId!==game.turnId)throw new Error('Kelime seçimi sırası değişti.');
  const word=game.choices.find(word=>word.id===msg.wordId);if(!word)throw new Error('Geçersiz kelime.');
  game.word=word;game.used.push(word.id);game.choices=[];game.phase='playing';game.startedAt=now;game.deadline=now+game.duration*1000;
  game.hintPositions=shuffled([...word.label].flatMap((letter,index)=>/[\p{L}\p{N}]/u.test(letter)?[index]:[])).slice(0,2);
  game.nextHintAt=now+30000<game.deadline?now+30000:null;
}
function finishRound(game,reason,now){
  game.history.push({round:game.round,drawer:game.drawer,word:game.word?.label||null,reason,guessed:Object.keys(game.guessed)});
  game.phase='review';game.deadline=now+5000;game.nextHintAt=null;
}
export function passDrawing(game,id,msg,now=Date.now()){
  if(!['choosing','playing'].includes(game.phase)||game.drawer!==id||msg.turnId!==game.turnId)throw new Error('Bu turu geçemezsin.');
  finishRound(game,'pass',now);
}
export function guessDrawing(game,id,msg,connected,now=Date.now()){
  if(game.phase!=='playing'||!game.participants.includes(id)||game.drawer===id||game.guessed[id]||msg.turnId!==game.turnId||now>=game.deadline)throw new Error('Bu turda tahmin yapamazsın.');
  const text=String(msg.text||'').trim().slice(0,80);if(!normalizeDrawingWord(text))throw new Error('Bir tahmin yaz.');
  if(now-(game.lastGuess[id]||0)<750)throw new Error('Biraz yavaş yaz.');game.lastGuess[id]=now;
  const correct=[game.word.label,...game.word.aliases].some(answer=>normalizeDrawingWord(answer)===normalizeDrawingWord(text));
  if(correct){const points=100+Math.round(Math.max(0,Math.min(1,(game.deadline-now)/(game.duration*1000)))*100);game.guessed[id]=points;game.scores[id]+=points;game.scores[game.drawer]+=40;game.chat.push({id:crypto.randomUUID(),player:id,type:'correct',points});}
  else game.chat.push({id:crypto.randomUUID(),player:id,type:'guess',text});
  game.chat=game.chat.slice(-60);
  const eligible=game.participants.filter(player=>player!==game.drawer&&connected.has(player));
  if(eligible.length&&eligible.every(player=>game.guessed[player]))finishRound(game,'solved',now);
}
export function applyDrawingInk(game,id,msg,now=Date.now()){
  if(game.phase!=='playing'||game.drawer!==id||msg.turnId!==game.turnId||now>=game.deadline)throw new Error('Şu anda çizemezsin.');
  if(typeof msg.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(msg.id)||!Number.isSafeInteger(msg.part)||msg.part<0||!Array.isArray(msg.points)||!msg.points.length||msg.points.length>80||!INK_COLORS.includes(msg.color)||!INK_WIDTHS.includes(msg.width)||!['brush','eraser'].includes(msg.tool))throw new Error('Geçersiz çizim.');
  if(msg.points.some(point=>!Array.isArray(point)||point.length!==2||point.some((v,index)=>!Number.isInteger(v)||v<0||v>(index===0?800:500))))throw new Error('Çizim alanı dışında nokta.');
  let stroke=game.strokes.at(-1);
  if(stroke?.id===msg.id&&msg.part<stroke.nextPart)return null;
  if(game.pointCount+msg.points.length>7000)throw new Error('Çizim doldu; geri al veya temizle.');
  if(stroke?.id!==msg.id){
    if(msg.part!==0||game.strokes.some(stroke=>stroke.id===msg.id)||game.strokes.length>=240)throw new Error('Çizgi sırası geçersiz veya çizim dolu.');
    stroke={id:msg.id,color:msg.tool==='eraser'?'#ffffff':msg.color,width:msg.width,tool:msg.tool,points:[],nextPart:0};game.strokes.push(stroke);
  }
  if(msg.part!==stroke.nextPart||stroke.width!==msg.width||stroke.tool!==msg.tool||(stroke.tool!=='eraser'&&stroke.color!==msg.color)||stroke.points.length+msg.points.length>2500)throw new Error('Çizgi sırası veya boyu geçersiz.');
  stroke.points.push(...msg.points);stroke.nextPart++;game.pointCount+=msg.points.length;game.canvasRev++;
  return {type:'drawing-ink',gameId:game.gameId,turnId:game.turnId,revision:game.canvasRev,id:stroke.id,part:msg.part,points:msg.points,color:stroke.color,width:stroke.width,tool:stroke.tool};
}
export function editDrawing(game,id,msg){
  if(game.phase!=='playing'||game.drawer!==id||msg.turnId!==game.turnId)throw new Error('Şu anda çizimi değiştiremezsin.');
  if(msg.type==='clear-drawing')game.strokes=[];else game.strokes.pop();
  game.pointCount=game.strokes.reduce((sum,stroke)=>sum+stroke.points.length,0);game.canvasRev++;
}
export function expireDrawing(game,connected,now=Date.now()){
  if(['choosing','playing'].includes(game.phase)&&game.drawerOfflineAt&&now>=game.drawerOfflineAt+5000&&!connected.has(game.drawer)){finishRound(game,'offline',now);return true;}
  if(game.phase==='playing'&&game.noGuessersAt&&now>=game.noGuessersAt+5000){finishRound(game,'empty',now);return true;}
  if(game.phase==='playing'&&now>=game.deadline){finishRound(game,'time',now);return true;}
  if(game.phase==='playing'&&game.nextHintAt&&now>=game.nextHintAt){game.hintCount++;const next=game.startedAt+(game.hintCount+1)*30000;game.nextHintAt=game.hintCount<2&&next<game.deadline?next:null;return true;}
  if(game.phase==='choosing'&&now>=game.deadline){chooseDrawingWord(game,game.drawer,{turnId:game.turnId,wordId:game.choices[secureIndex(game.choices.length)].id},now);return true;}
  if(game.phase==='review'&&now>=game.deadline){prepareRound(game,now);drawingPresence(game,connected,now);return true;}
  return false;
}
export function drawingPresence(game,connected,now=Date.now()){
  if(game.phase==='lobby'||game.phase==='results')return;
  const online=game.participants.filter(id=>connected.has(id));
  if(!online.length&&game.phase!=='paused'){game.previousPhase=game.phase;game.remaining=Math.max(1000,game.deadline-now);game.pauseAt=now;game.phase='paused';game.deadline=null;return;}
  if(game.phase==='paused'&&online.length){const gap=now-game.pauseAt;game.phase=game.previousPhase;game.deadline=now+game.remaining;if(game.startedAt)game.startedAt+=gap;if(game.nextHintAt)game.nextHintAt+=gap;delete game.previousPhase;}
  if(['choosing','playing'].includes(game.phase)){
    if(!connected.has(game.drawer))game.drawerOfflineAt ||= now;else game.drawerOfflineAt=null;
  }
  if(game.phase==='playing'){
    const guessers=online.filter(id=>id!==game.drawer);
    if(!guessers.length)game.noGuessersAt ||= now;else game.noGuessersAt=null;
    if(guessers.length&&guessers.every(id=>game.guessed[id]))finishRound(game,'solved',now);
  }
}
export function drawingDeadline(game){
  if(!['choosing','playing','review'].includes(game.phase))return null;
  return Math.min(game.deadline,game.phase==='playing'&&game.nextHintAt?game.nextHintAt:Infinity,['choosing','playing'].includes(game.phase)&&game.drawerOfflineAt?game.drawerOfflineAt+5000:Infinity,game.phase==='playing'&&game.noGuessersAt?game.noGuessersAt+5000:Infinity);
}
export function drawingView(game){
  const revealed=['review','results'].includes(game.phase);
  const hints=new Set(game.hintPositions.slice(0,game.hintCount));
  const mask=game.word?[...game.word.label].map((letter,index)=>/[\p{L}\p{N}]/u.test(letter)&&!hints.has(index)?'_':letter).join(' '):'';
  return {kind:game.kind,gameId:game.gameId,phase:game.phase,category:game.category,laps:game.laps,duration:game.duration,participants:game.participants,names:game.names,scores:game.scores,round:game.round,total:game.order.length,drawer:game.drawer,turnId:game.turnId,deadline:game.deadline,serverTime:Date.now(),mask,guessed:game.guessed,chat:game.chat,canvasRev:game.canvasRev,strokes:game.strokes.map(({id,color,width,tool,points})=>({id,color,width,tool,points})),...(revealed?{answer:game.word?.label||null,lastRound:game.history.at(-1)}:{}),...(game.phase==='results'?{winners:game.winners}:{})};
}
export function drawingPrivate(game,id){
  if(!game.participants.includes(id))return null;
  if(game.drawer===id&&game.phase==='choosing')return {choices:game.choices.map(({id,label})=>({id,label}))};
  if(game.drawer===id||game.guessed[id])return {word:game.word?.label||null};
  return null;
}
