(() => {
  let context = null, clock = null, direction = 'horizontal', pending = null, previousGame = null;
  let countries = [], countriesPromise = null, countryError = false, countrySearch = '', countryRound = null, countryActive = 0, countryMatches = [], countryPending = null;
  const root = document.querySelector('#activeGame');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const coord = cell => String.fromCharCode(65 + cell % 10) + (Math.floor(cell / 10) + 1);
  const title = game => game.kind === 'battleship' ? 'Amiral Battı' : game.kind === 'flags' ? 'Bayrak Yarışı' : game.category === 'football' ? 'Futbol Bilgi Düellosu' : 'LoL Bilgi Düellosu';
  function clear() { clearInterval(clock); clock = null; context = null; pending = null; previousGame = null; countrySearch = ''; countryRound = null; countryPending = null; }
  function seats(game, id, online) {
    return '<div class="duel-seats">' + game.players.map((player, side) => `<section class="duel-seat"><span>${side + 1}. OYUNCU</span><strong>${player ? esc(game.names[player]) + (player === id ? ' · SEN' : '') : 'Boş'}</strong><button class="subtle-button" data-duel-seat="${side}" ${player && player !== id && online.includes(player) ? 'disabled' : ''}>${player === id ? 'Seçili' : player && online.includes(player) ? 'Dolu' : 'Bu tarafta oyna'}</button></section>`).join('') + '</div>';
  }
  function render(game, settings) {
    clearInterval(clock);
    const nextKey = game.gameId + ':' + game.roundId;
    const oldInput = root.querySelector('#flagCountrySearch');
    const editing = oldInput && document.activeElement === oldInput ? { start:oldInput.selectionStart, end:oldInput.selectionEnd } : null;
    if (game.kind === 'flags' && countryRound !== nextKey) { countryRound=nextKey; countrySearch=''; countryActive=0; countryPending=null; }
    if (previousGame !== game.gameId) { direction = 'horizontal'; pending = null; }
    previousGame = game.gameId;
    if (pending && (pending !== nextKey || settings.triviaMine)) pending = null;
    context = { game, ...settings, receivedAt: settings.receivedAt || Date.now() };
    if (game.kind === 'battleship') renderNaval(); else renderQuiz();
    const newInput = root.querySelector('#flagCountrySearch');
    if (editing && newInput && !newInput.disabled) { newInput.focus({preventScroll:true}); newInput.setSelectionRange(editing.start,editing.end); }
    if (game.deadline) { updateClock(); clock = setInterval(updateClock, 200); }
  }
  function lobby(help, beginAction) {
    const { game:g, id, online, header } = context;
    const participant = g.players.includes(id), flags = g.kind === 'flags';
    root.innerHTML = header(title(g)) + (flags ? '<div class="match-scores">' + online.map(player => '<span class="chip">'+esc(context.names[player] || 'Oyuncu')+'</span>').join('') + '</div>' : seats(g,id,online)) + '<p class="review-hint">'+help+'</p><div class="duel-actions">'+(flags || participant ? '<button class="start-button" data-table-action="'+beginAction+'">'+(g.kind === 'battleship' ? 'Gemileri yerleştir' : 'Maçı başlat')+'</button>' : '<span class="chip">İzleyicisin</span>')+(participant && !flags ? '<button class="subtle-button" data-duel-seat="-1">İzleyici ol</button>' : '')+'</div>';
  }
  function navalBoard(fleet, shots, mode) {
    const shipCells = new Set(fleet.flat()), marked = new Map(shots.map(shot => [shot.cell, shot]));
    const sunk = new Set(shots.flatMap(shot => shot.sunk || []));
    let html = '<div class="naval-grid" role="group" aria-label="'+(mode === 'attack' ? 'Atış tahtası' : 'Filo tahtası')+'"><span></span>'+Array.from({length:10},(_,i)=>'<span class="naval-coordinate">'+String.fromCharCode(65+i)+'</span>').join('');
    for(let row=0;row<10;row++){
      html += '<span class="naval-coordinate">'+(row+1)+'</span>';
      for(let col=0;col<10;col++){
        const cell=row*10+col, shot=marked.get(cell), visible=shipCells.has(cell);
        const classes=['naval-cell',visible?'has-ship':'',shot?(shot.hit?'naval-hit':'naval-miss'):'',sunk.has(cell)?'naval-sunk':''].filter(Boolean).join(' ');
        const attr=mode==='place'?'data-place-ship="'+cell+'"':mode==='attack'&&!shot?'data-naval-shot="'+cell+'"':'';
        html+='<button class="'+classes+'" '+attr+' '+(!attr?'disabled':'')+' aria-label="'+coord(cell)+(shot?(shot.hit?', isabet':', ıska'):visible?', gemin':'')+'">'+(shot?(shot.hit?'×':'·'):'')+'</button>';
      }
    }
    return html+'</div>';
  }
  function renderNaval() {
    const { game:g,id,header,mine }=context;
    if(g.phase==='lobby')return lobby('1v1 · 10 × 10 alan · 5 gemi · Sırayla atış', 'begin-battleship');
    const participant=g.players.includes(id), enemy=g.players.find(player=>player!==id), fleet=mine?.fleet||[], ready=g.ready.includes(id);
    if(g.phase==='preparing'){
      const sizes=g.fleetSizes.map((size,index)=>'<span class="fleet-piece '+(index<fleet.length?'placed':index===fleet.length?'placing':'')+'">'+Array.from({length:size},()=>'<i></i>').join('')+'</span>').join('');
      root.innerHTML=header(title(g))+'<div class="code-score">'+g.players.map(player=>'<span class="chip">'+esc(g.names[player])+' · '+(g.ready.includes(player)?'Hazır':'Yerleştiriyor')+'</span>').join('')+'</div>'+(participant?'<div class="fleet-tray">'+sizes+'</div><div class="naval-setup">'+navalBoard(fleet,[],!ready&&fleet.length<5?'place':'view')+'</div><div class="duel-actions">'+(!ready?'<button class="category-chip selected" data-table-action="rotate-fleet">'+(direction==='horizontal'?'Yatay ↔':'Dikey ↕')+'</button><button class="subtle-button" data-table-action="random-fleet">Rastgele</button><button class="subtle-button" data-table-action="undo-ship" '+(!fleet.length?'disabled':'')+'>Geri al</button><button class="subtle-button" data-table-action="clear-fleet" '+(!fleet.length?'disabled':'')+'>Temizle</button><button class="start-button" data-table-action="ready-fleet" '+(fleet.length!==5?'disabled':'')+'>Hazırım</button>':'<span class="chip">Rakibin bekleniyor…</span>')+'</div><p class="review-hint">Geminin başlayacağı kareye dokun. Gemiler çapraz dahil birbirine değemez.</p>':'<div class="quiz-wait">Oyuncular filolarını yerleştiriyor.</div>');
      return;
    }
    const first=participant?id:g.players[0], second=g.players.find(player=>player!==first);
    const myShots=g.shots[first]||[], theirShots=g.shots[second]||[];
    const canShoot=participant&&g.phase==='playing'&&g.turn===id;
    let status=g.phase==='results'?esc(g.names[g.winner])+' kazandı'+(g.reason==='timeout'?' · Rakip üç kez süreyi kaçırdı.':'!'):g.phase==='paused'?'Oyuncu bekleniyor…':canShoot?'Sıra sende':'Sıra: '+esc(g.names[g.turn]);
    const hits=shots=>shots.filter(shot=>shot.hit).length;
    const last=g.lastShot?'<p class="review-hint">'+esc(g.names[g.lastShot.player])+' · '+(g.lastShot.timeout?'Süre doldu':coord(g.lastShot.cell)+' · '+(g.lastShot.sunk?'Gemi battı':g.lastShot.hit?'İsabet':'Iska'))+'</p>':'';
    root.innerHTML=header(title(g))+'<div class="duel-round-bar"><strong>'+status+'</strong>'+(g.phase==='playing'?'<b id="tableGameClock"></b>':'')+'</div><div class="code-score"><span class="chip">'+esc(g.names[first])+' · '+hits(myShots)+'/17 isabet</span><span class="chip">'+esc(g.names[second])+' · '+hits(theirShots)+'/17 isabet</span></div><div class="naval-boards"><section><h3>'+ (participant?'Rakibin suları':esc(g.names[second]))+'</h3>'+navalBoard(g.phase==='results'?g.fleets[second]:[],myShots,canShoot?'attack':'view')+'</section><section><h3>'+(participant?'Filon':esc(g.names[first]))+'</h3>'+navalBoard(participant?fleet:g.phase==='results'?g.fleets[first]:[],theirShots,'view')+'</section></div>'+last+(g.phase==='results'&&participant?'<button class="start-button" data-table-action="restart-table">Yeni maç</button>':'');
  }
  function quizScores(g) {
    const ids=[...g.participants].sort((a,b)=>g.mistakes[a]-g.mistakes[b]);
    return '<div class="quiz-scores">'+ids.map(player=>'<div class="quiz-score '+(player===context.id?'my-quiz-score':'')+'"><span>'+esc(g.names[player])+(player===context.id?' <small>SEN</small>':'')+'</span><strong>'+g.scores[player]+' <small>doğru</small><i> / </i>'+g.mistakes[player]+' <small>yanlış</small></strong></div>').join('')+'</div>';
  }
  const normalizeCountry = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('ı','i').replace(/[^a-z0-9]/g,'');
  function countryName(code) { return countries.find(country=>country.code===code)?.name || (code || ''); }
  function ensureCountries() {
    if (countries.length || countriesPromise) return;
    countryError=false;
    countriesPromise=fetch('/api/flags/countries').then(response=>{if(!response.ok)throw new Error('Ülke listesi yüklenemedi.');return response.json();}).then(data=>{
      if(!Array.isArray(data.countries)||!data.countries.length)throw new Error('Ülke listesi boş.');
      countries=data.countries.filter(country=>/^[a-z]{2}$/.test(country.code)&&typeof country.name==='string').sort((a,b)=>a.name.localeCompare(b.name,'tr'));
      if(context?.game.kind==='flags'&&!root.querySelector('#flagCountrySearch'))renderQuiz();else renderCountryResults();
    }).catch(()=>{countryError=true;renderCountryResults();}).finally(()=>{countriesPromise=null;});
  }
  function answerTimeLeft(){return context?.game.deadline-(context.game.serverTime+Date.now()-context.receivedAt);}
  function countryAnswerOpen(){return context?.game.kind==='flags'&&context.game.phase==='playing'&&context.game.participants.includes(context.id)&&!context.triviaMine&&!pending&&answerTimeLeft()>0;}
  function flagAnswerForm(g, participant, chosen, locked, reveal){
    ensureCountries();
    if(reveal)return '<div class="flag-answer-reveal"><span>Doğru ülke</span><strong>'+esc(g.answerLabel)+'</strong></div>'+(participant?'<p class="review-hint">'+(chosen?'Cevabın: '+esc(countryName(chosen)):'Bu tur cevap vermedin.')+'</p>':'');
    if(!participant)return '<p class="review-hint">İzleyicisin. Oyuncuların cevapları bekleniyor.</p>';
    if(locked)return '<div class="flag-answer-locked"><span>Seçimin</span><strong>'+esc(countryName(chosen))+'</strong><small>Cevabın kilitlendi.</small></div>';
    return '<div class="flag-country-picker"><label for="flagCountrySearch">Ülke ara</label><input id="flagCountrySearch" type="text" role="combobox" aria-autocomplete="list" aria-controls="flagCountryResults" aria-expanded="false" aria-describedby="flagCountryStatus" placeholder="Ülke adını yaz…" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="80" value="'+esc(countrySearch)+'"><div id="flagCountryResults" class="flag-country-results" role="listbox" aria-label="Ülkeler"></div><p id="flagCountryStatus" class="review-hint" role="status"></p></div>';
  }
  function renderCountryResults(){
    const input=root.querySelector('#flagCountrySearch'), list=root.querySelector('#flagCountryResults'), status=root.querySelector('#flagCountryStatus');
    if(!input||!list||!status)return;
    const term=normalizeCountry(countrySearch);
    countryMatches=term?countries.filter(country=>[country.name,...(country.aliases||[])].some(name=>normalizeCountry(name).includes(term))).sort((a,b)=>Number(normalizeCountry(b.name).startsWith(term))-Number(normalizeCountry(a.name).startsWith(term))).slice(0,8):[];
    countryActive=Math.max(0,Math.min(countryActive,countryMatches.length-1));
    const enabled=countryAnswerOpen();
    list.innerHTML=countryMatches.map((country,index)=>'<button type="button" role="option" tabindex="-1" id="flag-country-'+country.code+'" class="flag-country-result '+(index===countryActive?'country-active':'')+'" aria-selected="'+(index===countryActive)+'" data-country-code="'+country.code+'" '+(!enabled?'disabled':'')+'><span>'+esc(country.name)+'</span><small>Seç ↵</small></button>').join('');
    input.setAttribute('aria-expanded',String(countryMatches.length>0));
    if(countryMatches.length)input.setAttribute('aria-activedescendant','flag-country-'+countryMatches[countryActive].code);else input.removeAttribute('aria-activedescendant');
    status.innerHTML=countryError?'Ülke listesi yüklenemedi. <button type="button" class="subtle-button" data-table-action="retry-countries">Tekrar dene</button>':!countries.length?'Ülkeler yükleniyor…':!term?'Adını yaz, listeden ülkeyi seç.':!countryMatches.length?'Eşleşen ülke bulunamadı.':'';
  }
  function submitCountry(code){
    if(!countryAnswerOpen()||!countries.some(country=>country.code===code))return;
    const {game:g,send}=context;pending=g.gameId+':'+g.roundId;countryPending=code;
    renderQuiz();updateClock();
    send({type:'answer-trivia',gameId:g.gameId,roundId:g.roundId,country:code});
  }
  function renderQuiz() {
    const {game:g,id,header,triviaMine,roomCode}=context;
    if(g.phase==='lobby')return lobby(g.kind==='flags'?'2–8 kişi · 15 bayrak · 30 saniye · Ülke adını arayıp seç.':'1v1 · 10 ortak soru · 20 saniye · Her doğru cevap 1 puan.', 'begin-trivia');
    const participant=g.participants.includes(id), reveal=['review','results'].includes(g.phase);
    if(g.phase==='results'){
      const result=g.draw?'Berabere!':g.winners.map(player=>esc(g.names[player])).join(', ')+' kazandı!';
      const losers=g.kind==='flags'&&!g.draw?'<p class="review-hint">En çok yanlış: '+g.losers.map(player=>esc(g.names[player])).join(', ')+'</p>':'';
      root.innerHTML=header(title(g))+'<div class="quiz-result"><span class="eyebrow">MAÇ BİTTİ</span><h3>'+result+'</h3></div>'+quizScores(g)+losers+(participant?'<button class="start-button" data-table-action="restart-table">Yeni maç</button>':'');return;
    }
    const chosen=triviaMine||g.responses?.[id]||(g.kind==='flags'&&g.phase==='playing'&&pending===g.gameId+':'+g.roundId?countryPending:null), locked=Boolean(chosen)||pending===g.gameId+':'+g.roundId;
    const flag=g.question.hasFlag?'<div class="flag-question"><img id="quizFlag" src="/api/rooms/'+esc(roomCode)+'/flag?game='+encodeURIComponent(g.gameId)+'&amp;round='+encodeURIComponent(g.roundId)+'" alt="Tahmin edilecek ülke bayrağı" width="320" height="240"><p class="flag-error hidden">Görsel yüklenemedi. <button class="subtle-button" data-table-action="retry-flag">Tekrar yükle</button></p></div>':'';
    const options=g.kind==='flags'?flagAnswerForm(g,participant,chosen,locked,reveal):'<div class="quiz-options">'+g.question.options.map((option,index)=>'<button class="quiz-choice '+(reveal&&option.id===g.answer?'quiz-correct':reveal&&option.id===chosen?'quiz-wrong':option.id===chosen?'quiz-selected':'')+'" data-trivia-option="'+esc(option.id)+'" '+(!participant||reveal||locked?'disabled':'')+'><b>'+String.fromCharCode(65+index)+'</b><span>'+esc(option.label)+(option.englishLabel&&option.englishLabel!==option.label?'<small lang="en">('+esc(option.englishLabel)+')</small>':'')+'</span></button>').join('')+'</div>';
    const wait=reveal?'<div class="quiz-round-results">'+g.participants.map(player=>'<span class="'+(g.responses[player]===g.answer?'answer-right':'answer-wrong')+'">'+esc(g.names[player])+' · '+(g.responses[player]===g.answer?'Doğru':g.responses[player]?'Yanlış':'Süre doldu')+'</span>').join('')+'</div>':'<p class="review-hint">'+(participant?(locked?'Cevabın kilitlendi. ':''):'İzleyicisin · ')+g.answeredIds.length+'/'+g.participants.length+' cevap</p>';
    root.innerHTML=header(title(g))+'<div class="duel-round-bar"><span class="chip">'+g.round+' / '+g.total+'</span><b id="tableGameClock"></b></div>'+flag+'<h3 class="quiz-prompt">'+esc(g.question.prompt)+'</h3>'+options+wait+quizScores(g)+'<details class="media-credits"><summary>Kaynak</summary><p>'+(g.kind==='flags'?'<a href="https://github.com/lipis/flag-icons" target="_blank" rel="noopener noreferrer">flag-icons</a> · MIT · Yerel SVG görselleri.':g.category==='football'?'<a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">Wikidata</a> · CC0 · Mevcut kariyer ve ülke kayıtları.':'<a href="https://developer.riotgames.com/docs/lol#data-dragon" target="_blank" rel="noopener noreferrer">Riot Data Dragon</a> ve <a href="https://wiki.leagueoflegends.com/en-us/Universe:Main_Page" target="_blank" rel="noopener noreferrer">LoL Wiki</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a> · Çeviri ve tür gruplaması uygulanmıştır.')+'</p></details>';
    if(g.kind==='flags')renderCountryResults();
    const image=document.querySelector('#quizFlag');if(image)image.onerror=()=>{if(!image.isConnected)return;image.classList.add('hidden');image.closest('.flag-question')?.querySelector('.flag-error')?.classList.remove('hidden');};
  }
  function updateClock(){
    if(!context)return;
    const g=context.game, now=g.serverTime+Date.now()-context.receivedAt, left=Math.max(0,Math.ceil((g.deadline-now)/1000)), el=document.querySelector('#tableGameClock');
    if(el){el.textContent=(g.phase==='review'?'Sonraki soru · ':'')+left+' sn';el.classList.toggle('clock-urgent',left<=5&&g.phase!=='review');}
    if(!left)root.querySelectorAll('[data-trivia-option],[data-naval-shot],[data-country-code],#flagCountrySearch').forEach(button=>button.disabled=true);
  }
  function click(event){
    if(!context)return false;
    const {game:g,id,send}=context, button=event.target.closest('button');if(!button||button.disabled)return false;
    const message=type=>({type,gameId:g.gameId});
    if(button.hasAttribute('data-country-code')){submitCountry(button.dataset.countryCode);return true;}
    if(button.hasAttribute('data-duel-seat')){send({...message('claim-duel-seat'),side:Number(button.dataset.duelSeat)});return true;}
    if(button.hasAttribute('data-place-ship')){send({...message('place-ship'),cell:Number(button.dataset.placeShip),direction});return true;}
    if(button.hasAttribute('data-naval-shot')){root.querySelectorAll('[data-naval-shot]').forEach(cell=>cell.disabled=true);send({...message('shoot-battleship'),cell:Number(button.dataset.navalShot),turnId:g.turnId});return true;}
    if(button.hasAttribute('data-trivia-option')){if(pending)return true;pending=g.gameId+':'+g.roundId;root.querySelectorAll('[data-trivia-option]').forEach(cell=>cell.disabled=true);button.classList.add('quiz-selected');send({...message('answer-trivia'),roundId:g.roundId,option:button.dataset.triviaOption});return true;}
    const action=button.dataset.tableAction;if(!action)return false;
    if(action==='rotate-fleet'){direction=direction==='horizontal'?'vertical':'horizontal';renderNaval();return true;}
    if(action==='retry-flag'){renderQuiz();return true;}
    if(action==='retry-countries'){ensureCountries();renderCountryResults();return true;}
    if(action==='restart-table'){send({...message(g.kind==='battleship'?'start-battleship':g.kind==='flags'?'start-flags':'start-quiz'),category:g.category});return true;}
    send(message(action));return true;
  }
  root.addEventListener('pointerover',event=>{
    if(context?.game.kind!=='battleship'||context.game.phase!=='preparing')return;
    root.querySelectorAll('.fleet-preview,.fleet-invalid').forEach(cell=>cell.classList.remove('fleet-preview','fleet-invalid'));
    const button=event.target.closest('[data-place-ship]');if(!button)return;
    const fleet=context.mine?.fleet||[], size=context.game.fleetSizes[fleet.length];if(!size)return;
    const start=Number(button.dataset.placeShip), step=direction==='horizontal'?1:10, cells=Array.from({length:size},(_,n)=>start+n*step), placed=fleet.flat();
    const invalid=cells.some(cell=>cell>=100||(direction==='horizontal'&&Math.floor(cell/10)!==Math.floor(start/10))||placed.some(other=>Math.abs(other%10-cell%10)<=1&&Math.abs(Math.floor(other/10)-Math.floor(cell/10))<=1));
    for(const cell of cells)root.querySelector('[data-place-ship="'+cell+'"]')?.classList.add(invalid?'fleet-invalid':'fleet-preview');
  });
  root.addEventListener('input',event=>{if(event.target.id!=='flagCountrySearch')return;countrySearch=event.target.value.slice(0,80);countryActive=0;renderCountryResults();});
  root.addEventListener('keydown',event=>{
    if(event.target.id!=='flagCountrySearch')return;
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();if(!countryMatches.length)return;
      countryActive=(countryActive+(event.key==='ArrowDown'?1:-1)+countryMatches.length)%countryMatches.length;renderCountryResults();
      root.querySelector('#flag-country-'+countryMatches[countryActive].code)?.scrollIntoView({block:'nearest'});
    }else if(event.key==='Enter'){
      event.preventDefault();const selected=countryMatches[countryActive];if(selected)submitCountry(selected.code);
    }else if(event.key==='Escape'){
      countryMatches=[];countryActive=0;root.querySelector('#flagCountryResults').innerHTML='';event.target.setAttribute('aria-expanded','false');event.target.removeAttribute('aria-activedescendant');
    }
  });
  window.watchoutTableGames={render,click,clear,resetPending(){pending=null;countryPending=null;},recover(){pending=null;countryPending=null;if(context)render(context.game,context);}};
})();
