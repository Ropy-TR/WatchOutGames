(() => {
  const root=document.querySelector('#activeGame');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const colors=['#111827','#ffffff','#ef4444','#f97316','#facc15','#84cc16','#22c55e','#14b8a6','#38bdf8','#2563eb','#a855f7','#ec4899','#a16207','#9ca3af'];
  const categories=[['general','Genel'],['football','Ünlü Futbolcular'],['lol','League of Legends'],['objects','Eşyalar'],['games','Oyunlar'],['animals','Hayvanlar'],['jobs','Meslekler'],['food','Yiyecekler'],['mixed','Karışık']];
  let context=null,timer=null,draw=null,drawPending=null,cardPending=null,chatDraft='';
  function clear(){clearInterval(timer);timer=null;destroyCanvas();context=null;cardPending=null;chatDraft='';}
  function destroyCanvas(){if(!draw)return;clearInterval(draw.flushTimer);draw=null;drawPending=null;}
  function render(game,settings){
    clearInterval(timer);
    const changed=context?.game.gameId!==game.gameId;
    if(changed){chatDraft='';cardPending=null;destroyCanvas();}
    if(cardPending&&cardPending!==game.turnId)cardPending=null;
    context={game,...settings,receivedAt:performance.now()};
    if(game.kind==='old-maid'){destroyCanvas();renderCards();}else renderDrawing();
    tick();timer=setInterval(tick,200);
  }
  function namesChips(){return '<div class="match-scores">'+context.online.map(id=>'<span class="chip">'+esc(context.names[id]||'Oyuncu')+'</span>').join('')+'</div>';}
  function renderCards(){
    const {game:g,id,header,oldMaidMine}=context;
    if(g.phase==='lobby'){root.innerHTML=header('Papaz Kimde?')+namesChips()+'<p class="review-hint">2–8 kişi · Çiftler otomatik atılır · Papaz elinde kalan kaybeder.</p><button class="start-button" data-party-action="begin-old-maid">Kartları dağıt</button>';return;}
    const participant=g.participants.includes(id),myTurn=g.turn===id&&g.phase==='playing';
    const status=g.phase==='results'?esc(g.names[g.loser])+' · Papaz onda kaldı!':g.phase==='paused'?'Oyuncular bekleniyor…':myTurn?'Sıra sende':'Sıra: '+esc(g.names[g.turn]);
    const players=g.participants.map(player=>'<div class="papaz-player '+(player===g.turn?'papaz-active':'')+'"><span>'+esc(g.names[player])+(player===id?' <small>SEN</small>':'')+'</span><b>'+ (g.finished.includes(player)?'Eli bitti':g.counts[player]+' kart')+'</b></div>').join('');
    const backs=myTurn?'<section class="papaz-draw"><h3>'+esc(g.names[g.source])+' → bir kart seç</h3><div class="papaz-backs">'+Array.from({length:g.offerCount},(_,index)=>'<button class="playing-card card-back" data-papaz-card="'+index+'" aria-label="Kapalı kart '+(index+1)+'" '+(cardPending===g.turnId?'disabled':'')+'><span>W</span></button>').join('')+'</div></section>':'';
    const hand=oldMaidMine?.cards||[];
    const own=participant?'<section class="papaz-hand"><h3>Kartların <small>'+hand.length+'</small></h3><div class="playing-hand">'+hand.map(card=>'<div class="playing-card card-face '+(['♥','♦'].includes(card.suit)?'card-red':'')+'" aria-label="'+esc(card.rank+' '+card.suit)+'"><b>'+card.rank+'</b><strong>'+card.suit+'</strong><span>'+card.rank+'</span></div>').join('')+'</div>'+(!hand.length?'<p class="review-hint">Elindeki kartlar bitti.</p>':'')+'</section>':'<p class="review-hint">İzleyicisin.</p>';
    const last=g.lastDraw?'<p class="review-hint">'+esc(g.names[g.lastDraw.player])+', '+esc(g.names[g.lastDraw.source])+' adlı oyuncudan kart çekti.'+(g.lastDraw.paired?' Çift çıktı.':'')+(g.lastDraw.automatic?' Süre dolduğu için rastgele çekildi.':'')+'</p>':'';
    root.innerHTML=header('Papaz Kimde?')+'<div class="duel-round-bar"><strong>'+status+'</strong><b id="partyClock"></b></div><div class="papaz-players">'+players+'</div><p class="review-hint">'+g.pairs+'/24 çift atıldı</p>'+backs+own+last+(g.phase==='results'&&participant?'<button class="start-button" data-party-action="restart-party">Yeni maç</button>':'');
  }
  function drawingLobby(){
    const {game:g,header}=context;
    const select=(id,options,value)=>'<select id="'+id+'">'+options.map(([key,label])=>'<option value="'+key+'" '+(String(key)===String(value)?'selected':'')+'>'+label+'</option>').join('')+'</select>';
    root.innerHTML=header('Çiz & Tahmin Et')+namesChips()+'<div class="drawing-settings"><label>Kategori'+select('drawCategory',categories,g.category)+'</label><label>Kişi başına çizim'+select('drawLaps',[[1,'1 tur'],[2,'2 tur'],[3,'3 tur']],g.laps)+'</label><label>Süre'+select('drawDuration',[[60,'60 saniye'],[90,'90 saniye'],[120,'120 saniye']],g.duration)+'</label></div><button class="start-button" data-party-action="begin-drawing">Maçı başlat</button>';
  }
  function renderDrawing(){
    const {game:g,id,header,drawingMine:mine}=context;
    if(g.phase==='lobby'){destroyCanvas();drawingLobby();return;}
    if(!draw||draw.gameId!==g.gameId||!root.querySelector('#paintCanvas')){
      destroyCanvas();
      root.innerHTML=header('Çiz & Tahmin Et')+'<div class="drawing-round"><span id="drawRound" class="chip"></span><span id="drawRole"></span><b id="partyClock"></b></div><div id="drawWord" class="drawing-word"></div><div id="drawChoices" class="drawing-choices"></div><div class="paint-layout"><section class="paint-workspace"><div class="paint-surface"><canvas id="paintCanvas" width="800" height="500" aria-label="Ortak çizim alanı"></canvas><canvas id="paintOverlay" width="800" height="500" aria-label="Çizim yapmak için sürükle"></canvas></div><div id="paintToolbar" class="paint-toolbar"><div class="paint-palette">'+colors.map(color=>'<button type="button" data-ink-color="'+color+'" style="--swatch:'+color+'" aria-label="Renk '+color+'"></button>').join('')+'</div><div class="paint-tools"><button class="subtle-button" data-party-action="paint-brush">Kalem</button><button class="subtle-button" data-party-action="paint-eraser">Silgi</button><select id="paintWidth" aria-label="Fırça kalınlığı">'+[2,5,10,18,28].map(width=>'<option value="'+width+'" '+(width===5?'selected':'')+'>'+width+' px</option>').join('')+'</select><button class="subtle-button" data-party-action="undo-drawing">Geri al</button><button class="subtle-button" data-party-action="clear-drawing">Temizle</button><button class="subtle-button" data-party-action="pass-drawing">Pas</button></div></div><p id="drawNotice" class="review-hint"></p></section><aside class="drawing-chat-panel"><div id="drawScores" class="drawing-scores"></div><div id="drawChat" class="drawing-chat" role="log" aria-live="polite"></div><form id="drawGuessForm"><label class="visually-hidden" for="drawGuess">Tahminin</label><input id="drawGuess" maxlength="80" autocomplete="off" placeholder="Tahminini yaz…"><button class="primary-button" type="submit" aria-label="Tahmini gönder">Gönder</button></form></aside></div><div id="drawResults"></div>';
      draw={gameId:g.gameId,turnId:null,canvas:root.querySelector('#paintCanvas'),overlay:root.querySelector('#paintOverlay'),strokes:[],revision:0,pending:new Map(),active:null,colors,width:5,color:colors[0],tool:'brush',disconnected:false,syncing:false};
      bindCanvas();
    }
    if(draw.turnId!==g.turnId){draw.turnId=g.turnId;draw.pending.clear();draw.active=null;chatDraft='';}
    draw.disconnected=false;draw.strokes=g.strokes.map(stroke=>({...stroke,points:stroke.points.map(point=>[...point])}));draw.revision=g.canvasRev;draw.syncing=false;
    for(const [key,local] of draw.pending){const stored=draw.strokes.find(stroke=>stroke.id===key);if(stored&&stored.points.length>=local.sent){local.acked=local.lastSent;if(local.finished&&local.sent===local.points.length)draw.pending.delete(key);}}
    if(g.phase!=='playing'){draw.pending.clear();draw.active=null;}
    drawAll();
    root.querySelector('#drawRound').textContent=g.round+' / '+g.total;
    root.querySelector('#drawRole').textContent=g.phase==='results'?'Maç bitti':g.drawer===id?'Sen çiziyorsun':(g.names[g.drawer]||'Oyuncu')+' çiziyor';
    const reveal=['review','results'].includes(g.phase);
    const word=mine?.word|| (reveal?g.answer:null);
    root.querySelector('#drawWord').textContent=g.phase==='choosing'?(g.drawer===id?'Birini seç':'Çizen kişi kelime seçiyor…'):word||g.mask||'Tur geçildi';
    root.querySelector('#drawWord').classList.toggle('masked-word',!word&&g.phase==='playing');
    root.querySelector('#drawChoices').innerHTML=mine?.choices?.length?mine.choices.map(choice=>'<button class="category-chip" data-draw-word="'+esc(choice.id)+'">'+esc(choice.label)+'</button>').join(''):'';
    const canDraw=g.phase==='playing'&&g.drawer===id;
    root.querySelector('#paintToolbar').classList.toggle('hidden',!canDraw);
    draw.overlay.style.touchAction=canDraw?'none':'pan-y';draw.overlay.style.cursor=canDraw?'crosshair':'default';
    root.querySelector('#drawNotice').textContent=g.phase==='paused'?'Oyuncular bekleniyor…':reveal?(g.answer?'Kelime: '+g.answer:'Tur geçildi'):g.guessed[id]?'Bildin! +'+g.guessed[id]+' puan':!g.participants.includes(id)?'İzleyicisin.':canDraw?'Harf veya kelime yazmadan çiz.':'';
    const scores=[...g.participants].sort((a,b)=>g.scores[b]-g.scores[a]);
    root.querySelector('#drawScores').innerHTML=scores.map(player=>'<div class="drawing-score '+(g.guessed[player]?'drawing-guessed':'')+'"><span>'+esc(g.names[player])+(player===id?' <small>SEN</small>':'')+(player===g.drawer?' ✎':'')+'</span><b>'+g.scores[player]+'</b></div>').join('');
    const chat=root.querySelector('#drawChat'),nearBottom=chat.scrollHeight-chat.clientHeight-chat.scrollTop<55;
    chat.innerHTML=g.chat.map(message=>'<p class="'+(message.type==='correct'?'chat-correct':'')+'"><b>'+esc(g.names[message.player])+'</b> '+(message.type==='correct'?'bildi! +'+message.points:esc(message.text))+'</p>').join('');if(nearBottom)chat.scrollTop=chat.scrollHeight;
    const input=root.querySelector('#drawGuess');
    input.disabled=g.phase!=='playing'||g.drawer===id||Boolean(g.guessed[id])||!g.participants.includes(id);input.placeholder=g.guessed[id]?'Bu kelimeyi bildin!':g.drawer===id?'Şimdi çizim sırası sende':'Tahminini yaz…';
    if(input.value!==chatDraft)input.value=chatDraft;
    root.querySelector('#drawGuessForm button').disabled=input.disabled;
    root.querySelector('#drawResults').innerHTML=g.phase==='results'?'<div class="quiz-result"><h3>'+g.winners.map(player=>esc(g.names[player])).join(', ')+' kazandı!</h3></div>'+(g.participants.includes(id)?'<button class="start-button" data-party-action="restart-party">Yeni maç</button>':''):'';
    updateTools();
  }
  function mayPaint(){return draw&&!draw.disconnected&&context?.game.kind==='drawing'&&context.game.phase==='playing'&&context.game.drawer===context.id&&remaining()>0;}
  function paintStroke(canvas,stroke){
    if(!stroke.points.length)return;const c=canvas.getContext('2d');c.strokeStyle=stroke.color;c.fillStyle=stroke.color;c.lineWidth=stroke.width;c.lineCap='round';c.lineJoin='round';
    c.beginPath();c.arc(stroke.points[0][0],stroke.points[0][1],stroke.width/2,0,Math.PI*2);c.fill();
    if(stroke.points.length>1){c.beginPath();c.moveTo(...stroke.points[0]);for(let n=1;n<stroke.points.length;n++)c.lineTo(...stroke.points[n]);c.stroke();}
  }
  function drawAll(){
    if(!draw)return;const c=draw.canvas.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,800,500);const overlay=draw.overlay.getContext('2d');overlay.clearRect(0,0,800,500);
    for(const stroke of draw.strokes)if(!draw.pending.has(stroke.id))paintStroke(draw.canvas,stroke);
    for(const stroke of draw.pending.values())paintStroke(draw.overlay,stroke);
  }
  function flushInk(){
    if(!draw||!mayPaint())return;
    for(const stroke of draw.pending.values()){
      while(stroke.sent<stroke.points.length){
        const points=stroke.points.slice(stroke.sent,stroke.sent+80),part=stroke.nextPart++;
        stroke.sent+=points.length;stroke.lastSent=part;
        context.send({type:'draw-ink',gameId:context.game.gameId,turnId:context.game.turnId,id:stroke.id,part,points,color:stroke.color,width:stroke.width,tool:stroke.tool});
      }
      if(stroke.finished&&stroke.acked>=stroke.lastSent&&stroke.sent===stroke.points.length)draw.pending.delete(stroke.id);
    }
  }
  function endStroke(){if(!draw?.active)return;const stroke=draw.pending.get(draw.active);if(stroke)stroke.finished=true;draw.active=null;flushInk();drawAll();}
  function bindCanvas(){
    const overlay=draw.overlay;
    const point=event=>{const rect=overlay.getBoundingClientRect();return [Math.max(0,Math.min(800,Math.round((event.clientX-rect.left)/rect.width*800))),Math.max(0,Math.min(500,Math.round((event.clientY-rect.top)/rect.height*500)))];};
    function start(p){const id=crypto.randomUUID();draw.pending.set(id,{id,points:[p],color:draw.tool==='eraser'?'#ffffff':draw.color,width:draw.width,tool:draw.tool,sent:0,nextPart:0,lastSent:-1,acked:-1,finished:false,lastSample:performance.now()});draw.active=id;drawAll();}
    overlay.onpointerdown=event=>{if(!mayPaint()||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();endStroke();overlay.setPointerCapture(event.pointerId);start(point(event));};
    overlay.onpointermove=event=>{
      if(!mayPaint()||!draw.active||!overlay.hasPointerCapture(event.pointerId))return;
      event.preventDefault();let stroke=draw.pending.get(draw.active);if(!stroke)return;
      const p=point(event),last=stroke.points.at(-1),now=performance.now();if(now-stroke.lastSample<20||Math.hypot(p[0]-last[0],p[1]-last[1])<1.5)return;
      if(stroke.points.length>=1800){endStroke();start(last);stroke=draw.pending.get(draw.active);}
      stroke.points.push(p);stroke.lastSample=now;drawAll();
    };
    overlay.onpointerup=event=>{if(!draw||!overlay.hasPointerCapture(event.pointerId))return;const stroke=draw.pending.get(draw.active);if(stroke&&mayPaint()){const p=point(event),last=stroke.points.at(-1);if(p[0]!==last[0]||p[1]!==last[1])stroke.points.push(p);}endStroke();overlay.releasePointerCapture(event.pointerId);};
    overlay.onpointercancel=event=>{endStroke();if(overlay.hasPointerCapture(event.pointerId))overlay.releasePointerCapture(event.pointerId);};
    draw.flushTimer=setInterval(flushInk,50);
  }
  function ink(message){
    if(!draw||context?.game.gameId!==message.gameId||draw.turnId!==message.turnId||message.revision<=draw.revision)return;
    if(message.revision!==draw.revision+1){if(!draw.syncing){draw.syncing=true;context.send({type:'drawing-sync',gameId:context.game.gameId});}return;}
    let stroke=draw.strokes.at(-1);if(stroke?.id!==message.id){stroke={id:message.id,color:message.color,width:message.width,tool:message.tool,points:[]};draw.strokes.push(stroke);}
    stroke.points.push(...message.points);draw.revision=message.revision;
    const local=draw.pending.get(message.id);if(local){local.acked=message.part;if(local.finished&&local.acked>=local.lastSent&&local.sent===local.points.length)draw.pending.delete(local.id);}
    drawAll();
  }
  function updateTools(){if(!draw)return;root.querySelectorAll('[data-ink-color]').forEach(button=>button.classList.toggle('selected-ink',button.dataset.inkColor===draw.color&&draw.tool==='brush'));root.querySelector('[data-party-action="paint-brush"]')?.classList.toggle('selected-role',draw.tool==='brush');root.querySelector('[data-party-action="paint-eraser"]')?.classList.toggle('selected-role',draw.tool==='eraser');}
  function remaining(){if(!context?.game.deadline)return 0;return context.game.deadline-(context.game.serverTime+performance.now()-context.receivedAt);}
  function tick(){const el=root.querySelector('#partyClock');if(!el)return;el.textContent=context?.game.deadline?Math.max(0,Math.ceil(remaining()/1000))+' sn':'';if(remaining()<=0){root.querySelectorAll('[data-papaz-card]').forEach(button=>button.disabled=true);if(context?.game.kind==='drawing')root.querySelector('#drawGuessForm button').disabled=true;}}
  function click(event){
    if(!context)return false;const button=event.target.closest('button');if(!button||button.disabled)return false;
    const {game:g,send}=context;const msg=type=>({type,gameId:g.gameId,turnId:g.turnId});
    if(button.hasAttribute('data-papaz-card')){if(cardPending)return true;cardPending=g.turnId;root.querySelectorAll('[data-papaz-card]').forEach(button=>button.disabled=true);send({...msg('take-old-maid'),index:Number(button.dataset.papazCard)});return true;}
    if(button.hasAttribute('data-draw-word')){root.querySelectorAll('[data-draw-word]').forEach(button=>button.disabled=true);send({...msg('choose-drawing-word'),wordId:button.dataset.drawWord});return true;}
    if(button.hasAttribute('data-ink-color')){endStroke();draw.color=button.dataset.inkColor;draw.tool='brush';updateTools();return true;}
    const action=button.dataset.partyAction;if(!action)return false;
    if(action==='paint-brush'||action==='paint-eraser'){endStroke();draw.tool=action==='paint-brush'?'brush':'eraser';updateTools();return true;}
    if(['clear-drawing','undo-drawing','pass-drawing'].includes(action)){endStroke();draw.pending.clear();drawAll();}
    if(action==='restart-party'){send(msg(g.kind==='old-maid'?'start-old-maid':'start-drawing'));return true;}
    send(msg(action));return true;
  }
  root.addEventListener('change',event=>{
    if(!context)return;
    if(event.target.id==='paintWidth'&&draw){endStroke();draw.width=Number(event.target.value);return;}
    if(['drawCategory','drawLaps','drawDuration'].includes(event.target.id))context.send({type:'configure-drawing',gameId:context.game.gameId,category:root.querySelector('#drawCategory').value,laps:Number(root.querySelector('#drawLaps').value),duration:Number(root.querySelector('#drawDuration').value)});
  });
  root.addEventListener('input',event=>{if(event.target.id==='drawGuess')chatDraft=event.target.value;});
  root.addEventListener('submit',event=>{if(event.target.id!=='drawGuessForm')return;event.preventDefault();if(!context||!chatDraft.trim())return;context.send({type:'guess-drawing',gameId:context.game.gameId,turnId:context.game.turnId,text:chatDraft});chatDraft='';root.querySelector('#drawGuess').value='';});
  window.watchoutPartyGames={render,clear,click,ink,recover(){cardPending=null;if(draw){draw.active=null;draw.pending.clear();drawAll();if(context)context.send({type:'drawing-sync',gameId:context.game.gameId});}else if(context){if(context.game.kind==='drawing')drawingLobby();else renderCards();}},connectionLost(){cardPending=null;if(draw){draw.disconnected=true;draw.active=null;draw.pending.clear();drawAll();}}};
})();
