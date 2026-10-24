const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
let categories = ['Mekânlar'];
let gamesCatalogPromise;
let whoCards = [], whoDraft = '', whoDraftGame = '', whoCategory = 'Ünlüler';
let tabuCard = null, tabuInterval;
let battleshipMine = null, triviaMine = null, oldMaidMine = null, drawingMine = null;
const whoCategories = ['Ünlüler', 'Meslekler', 'Karışık'];
function loadGamesCatalog() { return gamesCatalogPromise ||= fetch('/api/games').then((r) => { if (!r.ok) throw new Error('Kategoriler yüklenemedi.'); return r.json(); }).then((data) => { categories = data.spyCategories; }).catch((error) => { gamesCatalogPromise = null; throw error; }); }
const cityCategories = ["İsim", "Şehir", "Ülke", "Hayvan", "Bitki", "Yemek", "Eşya", "Ünlü"];
let footballCatalog = null, catalogPromise = null;
async function loadFootballCatalog(version) {
  if (footballCatalog && (!version || (footballCatalog.version || footballCatalog.fetchedAt) === version)) return footballCatalog;
  if (!catalogPromise) catalogPromise = (async () => {
    const response = await fetch('/api/football' + (version ? '?v=' + encodeURIComponent(version) : ''));
    if (!response.ok) throw new Error('Futbolcu verisi yüklenemedi.');
    const catalog = await response.json();
    if (!catalog.playerCount || !Array.isArray(catalog.clubs)) throw new Error('Futbolcu verisi geçersiz.');
    footballCatalog = catalog;
    return catalog;
  })().finally(() => { catalogPromise = null; });
  return catalogPromise;
}

let lolCatalog = null, lolCatalogPromise = null;
async function loadLolCatalog(version) {
  if (lolCatalog && (!version || lolCatalog.version === version)) return lolCatalog;
  if (!lolCatalogPromise) lolCatalogPromise = fetch('/api/lol' + (version ? '?v=' + encodeURIComponent(version) : '')).then(async (response) => {
    if (!response.ok) throw new Error('Şampiyon verisi yüklenemedi.');
    const catalog = await response.json();
    if (!catalog.championCount || !Array.isArray(catalog.champions)) throw new Error('Şampiyon verisi geçersiz.');
    return lolCatalog = catalog;
  }).finally(() => { lolCatalogPromise = null; });
  return lolCatalogPromise;
}
const isGridGame = (game) => game?.kind === 'xox' || game?.kind === 'lol-xox';

let socket = null, current = null, playerId = localStorage.getItem("wg-player-id"), roomPass = "", myRole = null, currentGame = null, masterKeys = null, timerInterval = null, toastTimeout;
let cityDraftRound = null, cityDraft = {}, cityMine = {}, citySaveTimer = null, roomPlayers = [], xoxInterval = null;
let selectedCategory = categories[0], showMaster = false, cityStartedAt = 0, cityLetter = "", cityInterval = null;

function toast(text) { const el = $("#toast"); el.textContent = text; el.classList.add("show"); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove("show"), 2600); }
function notice(text) { const n = $("#roomNotice"); n.textContent = text; n.classList.toggle("hidden", !text); }
let lobbyRefresh = null, lobbyRequest = 0;
function setTab(tab) { $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab)); $("#joinForm").classList.toggle("hidden", tab !== "join"); $("#createForm").classList.toggle("hidden", tab !== "create"); $('#lobbyBrowser').classList.toggle('hidden', tab !== 'browse'); clearInterval(lobbyRefresh); if (tab === 'browse') { loadLobbies(); lobbyRefresh = setInterval(() => { if (!document.hidden && !$('#landing').classList.contains('hidden')) loadLobbies(); }, 10000); } }
const lobbyGames = { xox: 'Futbol XOX', 'lol-xox': 'LoL XOX', spyfall: 'Spyfall', codenames: 'Codenames', city: 'İsim Şehir', whoami: 'Kimim Ben?', tabu: 'Tabu', hockey: 'Hava Hokeyi', battleship: 'Amiral Battı', 'quiz-football': 'Futbol Bilgi Düellosu', 'quiz-lol': 'LoL Bilgi Düellosu', flags: 'Bayrak Yarışı', 'old-maid': 'Papaz Kimde?', drawing: 'Çiz & Tahmin Et' };
async function loadLobbies() {
  const requestId = ++lobbyRequest;
  const list = $('#lobbyList'); if (!list.children.length) list.textContent = 'Yükleniyor…';
  try {
    const response = await fetch('/api/rooms', { cache: 'no-store' });
    if (!response.ok) throw new Error('Lobiler yüklenemedi. Yenilemeyi dene.');
    const data = await response.json(); if (requestId !== lobbyRequest) return;
    const rooms = data.rooms.filter(room => /^[A-Z0-9]{5}$/.test(room.code));
    list.innerHTML = rooms.length ? rooms.map(room => `<button type="button" class="lobby-entry" data-lobby="${room.code}" ${room.full ? 'disabled' : ''}><strong>${room.code}</strong><span>${escapeHTML(lobbyGames[room.game] || 'Oyun seçiliyor')} · ${Number(room.playerCount)} / 8</span><small>${room.full ? 'Dolu' : 'Şifreyle katıl →'}</small></button>`).join('') : '<p class="empty-results">Şu an açık lobi yok.</p>';
  } catch (error) { if (requestId === lobbyRequest) list.textContent = error.message; }
}
$('#refreshLobbies').onclick = loadLobbies;
$('#lobbyList').onclick = event => { const entry = event.target.closest('[data-lobby]'); if (!entry || entry.disabled) return; $('#joinCode').value = entry.dataset.lobby; $('#joinPassword').value = ''; setTab('join'); ($('#joinNickname').value.trim() ? $('#joinPassword') : $('#joinNickname')).focus(); };
setInterval(() => { if (socket?.readyState === WebSocket.OPEN && !$('#room').classList.contains('hidden')) socket.send(JSON.stringify({ type: 'heartbeat' })); }, 30000);
$(".tab-row").addEventListener("click", (e) => { const tab = e.target.closest(".tab"); if (tab) setTab(tab.dataset.tab); });

$("#createForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const password = $("#createPassword").value.trim(), nickname = $("#createNickname").value.trim();
  if (password.length < 1) return toast("Bir oda şifresi belirle.");
  try { const res = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, listed: $('#listLobby').checked }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Oda oluşturulamadı."); connect(data.code, password, nickname); }
  catch (err) { toast(err.message || "Sunucuya ulaşılamadı."); }
});
$("#joinForm").addEventListener("submit", (e) => { e.preventDefault(); connect($("#joinCode").value.trim().toUpperCase(), $("#joinPassword").value, $("#joinNickname").value.trim()); });

function connect(code, password, nickname) {
  if (!/^[A-Z0-9]{5}$/.test(code)) return toast('5 karakterli oda kodunu kontrol et.');
  roomPass = password; current = { code, nickname }; myRole = null; masterKeys = null;
  let session = {}; try { session = JSON.parse(localStorage.getItem('wg-session-' + code) || '{}'); } catch {}
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  socket?.close();
  const connection = new WebSocket(scheme + '://' + location.host + '/api/rooms/' + code + '/socket');
  socket = connection;
  connection.onopen = () => connection.send(JSON.stringify({ type: 'join', password, nickname, playerId: session.playerId, sessionToken: session.sessionToken }));
  connection.onmessage = (event) => {
    if (socket !== connection) return;
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'hockey-frame') {
      if (currentGame?.kind === 'hockey' && msg.game?.gameId === currentGame.gameId && msg.game.tick >= currentGame.tick) { currentGame = msg.game; window.watchoutHockey.update(currentGame); }
      return;
    }
    if (msg.type === 'drawing-ink') { window.watchoutPartyGames.ink(msg); return; }
    if (msg.type === 'error') { toast(msg.message); window.watchoutTableGames.recover(); window.watchoutPartyGames.recover(); if (!currentGame) renderGame(null); return; }
    if (msg.type === 'joined') {
      window.watchoutTableGames.resetPending();
      playerId = msg.playerId;
      localStorage.setItem('wg-session-' + code, JSON.stringify({ playerId, sessionToken: msg.sessionToken }));
      showRoom(code, msg.room);
    }
    if (msg.type === 'room') {
      updatePlayers(msg.room);
      if (['old-maid','drawing'].includes(currentGame?.kind) && currentGame.phase === 'lobby' && msg.room.game?.kind === currentGame.kind) { currentGame = msg.room.game; renderPartyGame(currentGame); }
      if (currentGame?.kind === 'whoami') renderWhoami(currentGame);
      if (['battleship','quiz','flags'].includes(currentGame?.kind) && currentGame.phase === 'lobby' && msg.room.game?.kind === currentGame.kind) { currentGame = msg.room.game; renderTableGame(currentGame); }
      if (currentGame?.kind === 'hockey' && currentGame.phase === 'lobby' && msg.room.game?.kind === 'hockey') { currentGame = msg.room.game; renderHockey(currentGame); }
      if (currentGame?.kind === 'tabu' && msg.room.game?.kind === 'tabu') { if (currentGame.phase === 'lobby') currentGame = msg.room.game; renderTabu(currentGame); }
      if (currentGame?.kind === 'codenames' && currentGame.phase === 'lobby' && msg.room.game?.phase === 'lobby') { currentGame = msg.room.game; renderCodenames(currentGame, null); }
    }
    if (msg.type === 'game') {
      myRole = msg.role || null;
      whoCards = Array.isArray(msg.identityCards) ? msg.identityCards : [];
      tabuCard = msg.tabuCard || null;
      battleshipMine = msg.battleshipMine || null;
      triviaMine = msg.triviaMine || null;
      oldMaidMine = msg.oldMaidMine || null; drawingMine = msg.drawingMine || null;
      const changedCode = currentGame?.gameId !== msg.game?.gameId;
      const hadMaster = Boolean(masterKeys);
      masterKeys = Array.isArray(msg.master) ? msg.master : null;
      if (changedCode || (!hadMaster && masterKeys)) showMaster = Boolean(masterKeys);
      cityMine = msg.mine || {};
      window.watchoutPreferences?.notifyTurn(msg.game, playerId);
      renderGame(msg.game);
    }
  };
  connection.onclose = () => {
    if (socket !== connection || !current) return;
    window.watchoutPartyGames.connectionLost();
    notice('Bağlantı yenileniyor…');
    setTimeout(() => { if (socket === connection && current) connect(code, password, nickname); }, 1500);
  };
  connection.onerror = () => toast('Oda bağlantısı kurulamadı.');
}

function showRoom(code, room) { $("#landing").classList.add("hidden"); $("#room").classList.remove("hidden"); $("#roomCodeLabel").textContent = code; updatePlayers(room); notice(""); window.scrollTo(0, 0); }
function updatePlayers(room) { const players = room?.players || []; roomPlayers = players; window.hockeyOnlinePlayers = players.filter(p => p.online !== false).map(p => p.id); $("#playerCount").textContent = `${players.length} / 8`; $("#playerList").innerHTML = players.map((p, i) => `<div class="player"><span class="player-avatar">${escapeHTML(p.nickname.slice(0,1).toUpperCase())}</span><span>${escapeHTML(p.nickname)}${p.online === false ? " · çevrimdışı" : ""}</span>${p.id === playerId ? '<span class="you-tag">SEN</span>' : ""}</div>`).join(""); }
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function send(obj) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj)); else toast("Oda bağlantısı yok."); }
function copy(value, message) { if (!navigator.clipboard) return toast(value); navigator.clipboard.writeText(value).then(() => toast(message)).catch(() => toast(value)); }
$("#copyCode").onclick = () => copy(current.code, "Oda kodu kopyalandı.");
$("#shareRoom").onclick = () => copy(`${location.origin}/?oda=${current.code}`, "Davet bağlantısı kopyalandı. Şifreyi ayrıca paylaş.");
$("#leaveRoom").onclick = () => { window.watchoutPartyGames.clear(); window.watchoutTableGames.clear(); window.watchoutHockey.destroy(); send({ type: "leave" }); if (current) localStorage.removeItem("wg-session-" + current.code); clearInterval(xoxInterval); clearInterval(tabuInterval); clearTimeout(citySaveTimer); current = null; currentGame = null; myRole = null; masterKeys = null; $("#playerDialog").close(); socket?.close(); socket = null; clearInterval(timerInterval); clearInterval(cityInterval); $("#room").classList.add("hidden"); $("#landing").classList.remove("hidden"); $("#activeGame").classList.add("hidden"); $("#gamePicker").classList.remove("hidden"); window.scrollTo(0, 0); };

$$(".picker-card").forEach((card) => card.addEventListener("click", () => startGameMenu(card.dataset.game)));
function startGameMenu(kind) {
  notice(""); $("#gamePicker").classList.add("hidden"); const view = $("#activeGame"); view.classList.remove("hidden");
  if (kind === "spy") renderSpySetup(); else if (kind === "code") send({ type: "start-codenames" }); else if (kind === "city") startCity(); else if (kind === "xox") startXox(); else if (kind === "lol") startLol(); else if (kind === 'whoami') renderWhoSetup(); else if (kind === 'tabu') send({ type: 'start-tabu' }); else if (kind === 'hockey') send({ type: 'start-hockey' }); else if (kind === 'old-maid') send({ type: 'start-old-maid' }); else if (kind === 'drawing') send({ type: 'start-drawing' }); else if (kind === 'battleship') send({ type: 'start-battleship' }); else if (kind === 'flags') send({ type: 'start-flags' }); else if (kind.startsWith('quiz-')) send({ type: 'start-quiz', category: kind.slice(5) });
}
function renderHockey(game) { window.watchoutHockey.render(game, playerId, send, gameHeader('Hava Hokeyi')); }
function renderPartyGame(game) { window.watchoutPartyGames.render(game, { id: playerId, oldMaidMine, drawingMine, online: roomPlayers.filter(player => player.online !== false).map(player => player.id), names: Object.fromEntries(roomPlayers.map(player => [player.id, player.nickname])), send, header: gameHeader }); }
function renderTableGame(game) { window.watchoutTableGames.render(game, { id: playerId, mine: battleshipMine, triviaMine, roomCode: current?.code || '', online: roomPlayers.filter(player => player.online !== false).map(player => player.id), names: Object.fromEntries(roomPlayers.map(player => [player.id, player.nickname])), send, header: gameHeader }); }
function renderTabu(game) {
  clearInterval(tabuInterval);
  const teamName = (team) => team === 'red' ? 'Kırmızı' : 'Mavi';
  const teamPanels = ['red','blue'].map((team) => '<section class="team-panel ' + team + '"><h3>' + teamName(team) + '</h3><p>' + Object.entries(game.assignments).filter(([,value]) => value === team).map(([id]) => escapeHTML(game.names[id] || 'Oyuncu')).join(', ') + '</p>' + (game.phase === 'lobby' ? '<button class="subtle-button ' + (game.assignments[playerId] === team ? 'selected-role' : '') + '" data-tabu-team="' + team + '">Bu takıma katıl</button>' : '') + '</section>').join('');
  if (game.phase === 'lobby') { $('#activeGame').innerHTML = gameHeader('Tabu') + '<div class="code-teams">' + teamPanels + '</div><p class="review-hint">60 saniye · 3 pas · Her takıma 3 tur</p><button class="start-button" data-action="begin-tabu">Maçı başlat</button>'; return; }
  const participant = game.participants.includes(playerId), narrator = game.narrator === playerId, referee = game.referee === playerId;
  const online = (id) => roomPlayers.some((player) => player.id === id && player.online !== false);
  const score = '<div class="code-score"><span class="score-pill red">Kırmızı ' + game.scores.red + '</span><span class="score-pill blue">Mavi ' + game.scores.blue + '</span><span class="chip">Tur ' + game.round + ' / ' + game.rounds + '</span></div>';
  const winner = game.winner === 'draw' ? 'Berabere' : teamName(game.winner) + ' kazandı';
  let body = '', actions = '';
  if (game.phase === 'ready' || game.phase === 'playing') {
    const role = '<div class="code-score"><span class="chip">' + teamName(game.team) + ' anlatıyor</span><span class="chip">Anlatıcı: ' + escapeHTML(game.names[game.narrator]) + '</span><span class="chip">Hakem: ' + escapeHTML(game.names[game.referee]) + '</span></div>';
    if (game.phase === 'ready') {
      body = role + '<div class="tabu-wait">Hazır mısınız?</div>';
      if (narrator) actions += '<button class="start-button" data-action="start-tabu-turn">Anlatmaya başla</button>';
    } else {
      body = role + '<div class="tabu-status"><b id="tabuTimer"></b><span>Doğru ' + game.stats.correct + ' · Tabu ' + game.stats.tabu + ' · Pas ' + game.stats.passes + '/' + game.maxPasses + '</span></div>';
      body += tabuCard ? '<section class="tabu-card"><small>' + (referee ? 'Hakem kartı' : 'Anlatılacak kelime') + '</small><h3 id="tabuWord">' + escapeHTML(tabuCard.word) + '</h3><ul class="tabu-banned">' + tabuCard.banned.map((word) => '<li>' + escapeHTML(word) + '</li>').join('') + '</ul></section>' : '<div class="tabu-wait">' + (!participant ? 'Bu maçta izleyicisin.' : game.assignments[playerId] === game.team ? 'Takım arkadaşının anlattığını tahmin et.' : 'Diğer takım oynuyor.') + '</div>';
      if (narrator) actions += '<button class="start-button" data-tabu-action="correct">Doğru +1</button><button class="subtle-button" data-tabu-action="pass"' + (game.stats.passes >= game.maxPasses ? ' disabled' : '') + '>Pas (' + (game.maxPasses-game.stats.passes) + ')</button>';
      if (narrator || referee) actions += '<button class="subtle-button tabu-foul" data-tabu-action="tabu">Tabu −1</button>';
    }
    if (participant && !online(game.narrator) && game.assignments[playerId] === game.team) actions += '<button class="subtle-button" data-tabu-role="narrator">Anlatıcılığı devral</button>';
    if (participant && !online(game.referee) && game.assignments[playerId] !== game.team) actions += '<button class="subtle-button" data-tabu-role="referee">Hakemliği devral</button>';
  } else {
    const last = game.history.at(-1);
    body = '<h3 class="match-result">' + (game.phase === 'results' ? winner : 'Süre bitti · ' + teamName(last.team) + ' ' + (last.points >= 0 ? '+' : '') + last.points) + '</h3><div class="tabu-review">' + last.cards.map((card) => '<div><span>' + escapeHTML(card.word) + '</span><small>' + ({correct:'+1',tabu:'−1',pass:'Pas',time:'Süre bitti'}[card.result]) + '</small></div>').join('') + '</div>';
    if (participant) actions = '<button class="start-button" data-action="' + (game.phase === 'results' ? 'restart-tabu' : 'next-tabu-turn') + '">' + (game.phase === 'results' ? 'Yeni maç' : 'Sonraki takım') + '</button>';
  }
  $('#activeGame').innerHTML = gameHeader('Tabu') + score + body + '<div class="tabu-controls">' + actions + '</div>';
  if (game.phase === 'playing') {
    const clock = () => {
      const sec = Math.max(0,Math.ceil((game.deadline-Date.now())/1000));const timer = $('#tabuTimer');if(timer)timer.textContent=sec+' sn';
      if(!sec)for(const button of $$('[data-tabu-action]'))button.disabled=true;
    };
    clock();tabuInterval=setInterval(clock,250);
  }
}
function whoCategoryOptions(selected) { return whoCategories.map((category) => '<option' + (selected === category ? ' selected' : '') + '>' + category + '</option>').join(''); }
function renderWhoSetup() {
  $('#activeGame').innerHTML = gameHeader('Kimim Ben?') + '<div class="who-setup"><label for="whoCategory">Kategori</label><select id="whoCategory">' + whoCategoryOptions(whoCategory) + '</select><button class="start-button" data-action="start-whoami">Başlat</button></div>';
}
function renderWhoami(game) {
  const participant = game.participants.includes(playerId), solved = game.solved.includes(playerId);
  const mine = whoCards.find((card) => card.id === playerId);
  const myTurn = game.phase === 'playing' && game.turn === playerId && !solved;
  const offlineTurn = game.phase === 'playing' && !roomPlayers.some((player) => player.id === game.turn && player.online !== false);
  if (whoDraftGame !== game.gameId || !myTurn) whoDraft = '';
  whoDraftGame = game.gameId;
  const cards = whoCards.filter((card) => card.id !== playerId).map((card) => '<article class="who-card" data-who-player="' + escapeHTML(card.id) + '"><div><span>' + escapeHTML(card.name) + '</span>' + (card.solved ? '<small>Buldu</small>' : game.turn === card.id ? '<small>Sıra onda</small>' : '') + '</div><strong>' + escapeHTML(card.identity || 'Gizli') + '</strong></article>').join('');
  const self = participant ? '<section class="who-self"><span>Senin kimliğin</span><strong id="whoOwnIdentity">' + escapeHTML(mine?.identity || '???') + '</strong>' + (solved ? '<small>Doğru bildin!</small>' : game.phase === 'playing' ? '<small>Diğer oyuncular görüyor.</small>' : '') + '</section>' : '<p class="review-hint">Sonraki turda katılacaksın.</p>';
  const order = game.solved.length ? '<p class="review-hint">Bulanlar: ' + game.solved.map((id, i) => (i + 1) + '. ' + escapeHTML(game.names[id])).join(' · ') + '</p>' : '';
  const guessing = myTurn ? '<form id="whoGuessForm" class="who-guess"><input id="whoGuess" aria-label="Kimlik tahminin" placeholder="Ben kimim?" maxlength="80" autocomplete="off" value="' + escapeHTML(whoDraft) + '" required><button class="start-button">Tahmin et</button></form>' : '';
  const controls = game.phase === 'playing' ? (participant && (myTurn || offlineTurn) ? '<button class="subtle-button" data-action="pass-whoami">' + (offlineTurn ? 'Çevrimdışı oyuncuyu geç' : 'Pas geç') + '</button>' : '') + (participant ? '<button class="subtle-button" data-action="finish-whoami">Turu bitir</button>' : '') : participant ? '<label for="whoNextCategory">Kategori</label><select id="whoNextCategory">' + whoCategoryOptions(game.category) + '</select><button class="start-button" data-action="next-whoami">Sonraki tur</button>' : '';
  const status = game.phase === 'results' ? 'Tur bitti' : myTurn ? 'Sıra sende' : 'Sıra: ' + (game.names[game.turn] || '—');
  $('#activeGame').innerHTML = gameHeader('Kimim Ben?') + '<div class="code-score"><span class="chip">' + escapeHTML(game.category) + '</span><span class="chip">Tur ' + game.round + '</span><span class="chip">' + escapeHTML(status) + '</span></div>' + self + '<div class="who-grid">' + cards + '</div>' + guessing + '<div class="who-controls">' + controls + '</div>' + order;
}
$('#activeGame').addEventListener('input', (event) => { if (event.target.id === 'whoGuess') whoDraft = event.target.value; });
$('#activeGame').addEventListener('submit', (event) => {
  if (event.target.id !== 'whoGuessForm') return;
  event.preventDefault();
  send({ type: 'guess-whoami', gameId: currentGame.gameId, turnId: currentGame.turnId, guess: $('#whoGuess').value });
});
function gameHeader(title) { return `<div class="game-title-row"><h2>${title}</h2><button class="subtle-button" data-action="menu">Oyunlar</button></div>`; }
async function renderSpySetup() {
  currentGame = { kind: 'spyfall-setup' };
  try { await loadGamesCatalog(); } catch (error) { toast(error.message); renderGame(null); return; }
  if (currentGame?.kind !== 'spyfall-setup') return;
  $('#activeGame').innerHTML = gameHeader('Spyfall') + '<div class="category-row">' + categories.map((c) => '<button class="category-chip ' + (c === selectedCategory ? 'selected' : '') + '" data-category="' + escapeHTML(c) + '">' + escapeHTML(c) + '</button>').join('') + '</div><button class="start-button" data-action="start-spy">Başlat</button>';
}
function matchScores(names, scores, winners = []) {
  return '<div class="match-scores">' + Object.entries(scores || {}).map(([id, score]) => '<span class="chip ' + (winners.includes(id) ? 'score-winner' : '') + '">' + escapeHTML(names[id] || 'Oyuncu') + ' <b>' + score + '</b></span>').join('') + '</div>';
}
function matchWinners(names, winners) { return winners.map((id) => escapeHTML(names[id] || 'Oyuncu')).join(', '); }
let spyScratchKey = '', spyScratch = { crossed: [], note: '' };
function loadSpyScratch(game) {
  const key = 'wg-spy-private:' + (current?.code || '') + ':' + playerId + ':' + game.gameId;
  if (key !== spyScratchKey) { spyScratchKey = key; spyScratch = { crossed: [], note: '' }; try { const saved = JSON.parse(sessionStorage.getItem(key) || 'null'); if (saved && Array.isArray(saved.crossed) && typeof saved.note === 'string') spyScratch = saved; } catch {} }
  return spyScratch;
}
function saveSpyScratch() { try { sessionStorage.setItem(spyScratchKey, JSON.stringify(spyScratch)); } catch {} }
function renderSpy(game) {
  const scratch = loadSpyScratch(game);
  const focusedNote = document.activeElement?.id === 'spyPrivateNote';
  const noteSelection = focusedNote ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  clearInterval(timerInterval);
  const role = myRole, participant = game.participants.includes(playerId);
  const guessSelection = $('#spyGuessLocation')?.value;
  const heading = role ? role.spy ? 'Sen casussun' : escapeHTML(role.location) : 'İzleyici';
  let controls = '';
  if (game.phase === 'playing' && participant) controls = '<button class="start-button" data-action="spy-vote">Oylama başlat</button>' + (role?.spy ? '<button class="subtle-button" data-action="spy-guess">Tahmin et</button>' : '');
  if (game.phase === 'voting') {
    const voted = game.vote.votedIds.includes(playerId);
    controls = '<div class="vote-panel"><h3>Casus kim?</h3><p>' + game.vote.votedIds.length + '/' + game.participants.length + ' oy · ' + (Math.floor(game.participants.length / 2) + 1) + ' oy gerekli</p><div class="category-row">' + game.participants.map((id) => '<button class="category-chip" data-spy-vote="' + id + '"' + (voted || !participant ? ' disabled' : '') + '>' + escapeHTML(game.names[id]) + ' · ' + (game.vote.counts[id] || 0) + '</button>').join('') + '</div><button class="subtle-button" data-spy-vote="__abstain"' + (voted || !participant ? ' disabled' : '') + '>Oy kullanmak istemiyorum</button><p>' + (game.vote.abstained || 0) + ' çekimser' + (voted ? ' · Tercihin kaydedildi.' : '') + '</p></div>';
  }
  if (game.phase === 'guessing') {
    controls = '<div class="vote-panel"><h3>' + (game.guess.mode === 'caught' ? 'Casus bulundu · son tahmin' : 'Casus tahmin ediyor') + '</h3>';
    if (role?.spy) controls += '<form id="spyGuessForm" class="spy-guess-form"><select id="spyGuessLocation" name="location" aria-label="Cevap tahmini" required><option value="">Cevap seç</option>' + game.candidates.map((word) => '<option value="' + escapeHTML(word) + '"' + (word === guessSelection ? ' selected' : '') + '>' + escapeHTML(word) + '</option>').join('') + '</select><button class="start-button">Tahmini gönder</button></form>';
    else controls += '<p>' + escapeHTML(game.names[game.guess.spyId]) + ' tahminini seçiyor.</p>';
    controls += '</div>';
  }
  if (game.phase === 'results') {
    const labels = { 'wrong-vote': 'Yanlış kişi seçildi. Casus +2 puan.', 'guess-correct': 'Casus doğru tahmin etti. +2 puan.', 'caught-correct': 'Casus bulundu ve doğru tahmin etti. +1 puan.', 'guess-wrong': 'Casus yanlış tahmin etti. Masumların her biri +2 puan.', 'guess-timeout': 'Casus tahmin edemedi. Masumların her biri +2 puan.', escaped: 'Casus bulunamadı. Casus +2 puan.' };
    controls = '<div class="notice">' + labels[game.result.reason] + '<p>Casus: ' + escapeHTML(game.names[game.result.spyId]) + ' · Cevap: ' + escapeHTML(game.result.location) + '</p></div>' + (game.match.finished ? '<h3 class="match-result">Maç bitti · ' + matchWinners(game.names, game.match.winners) + ' kazandı</h3>' : '') + (participant ? '<button class="start-button" data-action="' + (game.match.finished ? 'new-spy-match' : 'next-spy') + '">' + (game.match.finished ? 'Yeni maç' : 'Sonraki tur') + '</button>' : '');
  }
  const deadline = game.phase === 'voting' ? game.vote.deadline : game.phase === 'guessing' ? game.guess.deadline : game.startedAt + game.duration * 1000;
  $('#activeGame').innerHTML = gameHeader('Spyfall') + matchScores(game.names, game.match.scores, game.match.winners) + '<div class="spy-meta"><span class="chip">' + escapeHTML(game.category) + '</span><span class="chip">Tur ' + game.round + ' · Hedef 10 puan</span></div>' + (game.phase !== 'results' ? '<div class="spy-role ' + (role?.spy ? 'role-spy' : '') + '"><h3>' + heading + '</h3></div><div class="timer" id="spyTimer"></div>' : '') + '<div class="spy-match-controls">' + controls + '</div><h3 class="list-title">Olası cevaplar</h3><div class="spy-candidates">' + game.candidates.map((word) => '<button type="button" class="spy-candidate' + (scratch.crossed.includes(word) ? ' crossed' : '') + '" data-spy-cross="' + escapeHTML(word) + '" aria-pressed="' + scratch.crossed.includes(word) + '">' + escapeHTML(word) + '</button>').join('') + '</div><section class="spy-notes"><label for="spyPrivateNote">Kişisel notların</label><textarea id="spyPrivateNote" maxlength="5000" placeholder="Yalnızca sen görebilirsin…">' + escapeHTML(scratch.note) + '</textarea></section>';
  if (focusedNote) { const note = $('#spyPrivateNote'); note.focus(); note.setSelectionRange(...noteSelection); }
  if (game.phase !== 'results') {
    const clock = () => { const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); const el = $('#spyTimer'); if (el) { const format = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0'); el.textContent = game.phase === 'voting' ? 'Oylama ' + format(sec) + ' · Tur ' + format(Math.ceil(game.vote.remaining / 1000)) + ' (duraklatıldı)' : format(sec); } };
    clock(); timerInterval = setInterval(clock, 250);
  }
}
function renderCodenames(game, master) {
  const me = game.assignments?.[playerId];
  const teamName = (team) => team === 'red' ? 'Kırmızı' : 'Mavi';
  const roster = (team) => Object.entries(game.assignments).filter(([, role]) => role.team === team).map(([id, role]) => escapeHTML(game.names?.[id] || 'Oyuncu') + (role.role === 'master' ? ' (anlatıcı)' : '')).join(', ') || '—';
  const teams = '<div class="code-teams">' + ['red', 'blue'].map((team) => '<section class="team-panel ' + team + '"><h3>' + teamName(team) + '</h3><p>' + roster(team) + '</p>' + (game.phase === 'lobby' ? ['master', 'guesser'].map((role) => '<button class="subtle-button ' + (me?.team === team && me?.role === role ? 'selected-role' : '') + '" data-code-team="' + team + '" data-code-role="' + role + '">' + (role === 'master' ? 'Anlatıcı ol' : 'Tahminci ol') + '</button>').join(' ') : '') + '</section>').join('') + '</div>';
  if (game.phase === 'lobby') { $('#activeGame').innerHTML = gameHeader('Codenames') + teams + '<button class="start-button" data-action="begin-code">Başlat</button>'; return; }
  const canGuess = game.phase === 'playing' && me?.role === 'guesser' && me.team === game.turn && game.clue;
  const cards = game.words.map((word, i) => {
    const revealed = game.revealed.includes(i);
    const key = game.colors?.[i] || (showMaster ? master?.[i] : null);
    const color = key === 'neutral' ? 'revealed' : key || '';
    return '<button class="word-card ' + color + '" data-pick="' + i + '"' + (!canGuess || revealed ? ' disabled' : '') + '>' + escapeHTML(word) + '</button>';
  }).join('');
  const status = game.winner ? teamName(game.winner) + ' takım kazandı.' : teamName(game.turn) + ' takımın sırası';
  const clue = game.clue ? '<p class="code-clue">' + escapeHTML(game.clue.word) + ' · ' + game.clue.count + ' <span>(' + game.guessesLeft + ' tahmin)</span></p>' : '<p class="code-clue">İpucu bekleniyor</p>';
  const form = game.phase === 'playing' && me?.role === 'master' && me.team === game.turn && !game.clue ? '<form id="codeClueForm" class="clue-form"><input name="word" aria-label="İpucu" placeholder="Tek kelime" maxlength="40" required><select name="count" aria-label="Kelime sayısı">' + Array.from({ length: 10 }, (_, n) => '<option' + (n === 1 ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><button class="start-button">İpucu ver</button></form>' : '';
  $('#activeGame').innerHTML = gameHeader('Codenames') + teams + '<div class="code-score"><span class="score-pill red">Kırmızı ' + game.scores.red + '/' + game.targets.red + '</span><span class="score-pill blue">Mavi ' + game.scores.blue + '/' + game.targets.blue + '</span><span class="chip">' + status + '</span></div>' + (game.winner ? '' : clue + form) + '<div class="game-grid">' + cards + '</div><div class="active-foot">' + (master ? '<button class="subtle-button" data-action="master">' + (showMaster ? 'Anahtarı gizle' : 'Anahtarı göster') + '</button>' : '') + (canGuess ? '<button class="subtle-button" data-action="pass-code">Sırayı bitir</button>' : '') + (game.winner ? '<button class="start-button" data-action="new-code">Yeni oyun</button>' : '') + '</div>';
}

function xoxTeamChips(game) {
  const mine = ['X', 'O'].find(team => game.teams?.[team]?.includes(playerId));
  $('#activeGame').dataset.xoxTeam = mine || 'X';
  return ['X', 'O'].map(team => '<span class="chip xox-team-chip owner-' + team + '"><b>' + team + '</b><span>' + (game.teams?.[team] || []).map(id => escapeHTML(game.names[id] || 'Oyuncu')).join(', ') + '</span>' + (mine === team ? '<small>SEN</small>' : '') + '</span>').join('');
}
function renderGame(game, master) {
  if (!['old-maid','drawing'].includes(game?.kind)) window.watchoutPartyGames.clear();
  if (!['battleship','quiz','flags'].includes(game?.kind)) window.watchoutTableGames.clear();
  if (!isGridGame(game)) delete $('#activeGame').dataset.xoxTeam;
  if (game?.kind !== 'hockey') window.watchoutHockey.destroy();
  clearInterval(tabuInterval);
  if (!game) { currentGame = null; clearInterval(cityInterval); clearInterval(xoxInterval); $("#playerDialog").close(); $("#activeGame").classList.add("hidden"); $("#gamePicker").classList.remove("hidden"); clearInterval(timerInterval); return; }
  if (game.kind !== "city") { clearInterval(cityInterval); clearTimeout(citySaveTimer); }
  clearInterval(xoxInterval);
  if (!isGridGame(game)) $("#playerDialog").close();
  if (game.kind !== "spyfall") clearInterval(timerInterval);
  $("#gamePicker").classList.add("hidden"); $("#activeGame").classList.remove("hidden"); currentGame = game;
  if (game.kind === "spyfall") renderSpy(game);
  if (game.kind === "codenames") renderCodenames(game, masterKeys || master);
  if (game.kind === "city") renderCity(game);
  if (game.kind === 'whoami') renderWhoami(game);
  if (game.kind === 'tabu') renderTabu(game);
  if (game.kind === 'hockey') renderHockey(game);
  if (['old-maid','drawing'].includes(game.kind)) renderPartyGame(game);
  if (['battleship','quiz','flags'].includes(game.kind)) renderTableGame(game);
  if (isGridGame(game)) { currentGame = game; if (selectedXoxCell && (game.picks[selectedXoxCell] || game.boardId !== selectedXoxBoard || game.turnId !== selectedXoxTurn)) $("#playerDialog").close(); if (game.kind === "lol-xox") renderLol(); else renderXox(); }
}
$("#activeGame").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "menu") { send({ type: "stop-game" }); return; }
  if (window.watchoutPartyGames.click(e)) return;
  if (window.watchoutTableGames.click(e)) return;
  const hockeySide = e.target.closest('[data-hockey-side]'); if (hockeySide) { send({ type: 'join-hockey', gameId: currentGame.gameId, side: Number(hockeySide.dataset.hockeySide) }); return; }
  if (action === 'begin-hockey') { send({ type: 'begin-hockey', gameId: currentGame.gameId }); return; }
  if (action === 'leave-hockey-seat') { send({ type: 'leave-hockey-seat', gameId: currentGame.gameId }); return; }
  if (action === 'restart-hockey') { send({ type: 'start-hockey', gameId: currentGame.gameId }); return; }
  const tabuTeam = e.target.closest('[data-tabu-team]'); if (tabuTeam) { send({ type:'join-tabu-team',gameId:currentGame.gameId,team:tabuTeam.dataset.tabuTeam }); return; }
  if (action === 'begin-tabu') { send({ type:'begin-tabu',gameId:currentGame.gameId }); return; }
  if (action === 'restart-tabu') { send({ type:'start-tabu',gameId:currentGame.gameId,restart:true }); return; }
  if (action === 'start-tabu-turn' || action === 'next-tabu-turn') { send({ type:action,gameId:currentGame.gameId,turnId:currentGame.turnId }); return; }
  const tabuRole = e.target.closest('[data-tabu-role]'); if(tabuRole) { send({ type:'claim-tabu-role',gameId:currentGame.gameId,turnId:currentGame.turnId,role:tabuRole.dataset.tabuRole }); return; }
  const tabuButton = e.target.closest('[data-tabu-action]'); if(tabuButton && tabuCard) { send({ type:'tabu-card-action',gameId:currentGame.gameId,turnId:currentGame.turnId,cardId:tabuCard.id,action:tabuButton.dataset.tabuAction }); return; }
  if (action === 'start-whoami') { whoCategory = $('#whoCategory').value; send({ type: 'start-whoami', category: whoCategory }); return; }
  if (action === 'next-whoami') { send({ type: 'next-whoami', gameId: currentGame.gameId, category: $('#whoNextCategory').value }); return; }
  if (action === 'pass-whoami') { send({ type: 'pass-whoami', gameId: currentGame.gameId, turnId: currentGame.turnId }); return; }
  if (action === 'finish-whoami') { send({ type: 'finish-whoami', gameId: currentGame.gameId }); return; }
  if (action === "start-spy") { send({ type: "start-spyfall", category: selectedCategory }); return; }
  if (action === "next-spy") { send({ type: "next-spy", gameId: currentGame.gameId }); return; }
  if (action === "spy-vote") { send({ type: "start-spy-vote", gameId: currentGame.gameId }); return; }
  if (action === "spy-guess") { send({ type: "start-spy-guess", gameId: currentGame.gameId }); return; }
  if (action === "new-spy-match") { send({ type: "start-spyfall", category: currentGame.category, gameId: currentGame.gameId, restart: true }); return; }
  const crossTarget = e.target.closest('[data-spy-cross]'); if (crossTarget && currentGame?.kind === 'spyfall') { const word = crossTarget.dataset.spyCross; const scratch = loadSpyScratch(currentGame); scratch.crossed = scratch.crossed.includes(word) ? scratch.crossed.filter(value => value !== word) : [...scratch.crossed, word]; saveSpyScratch(); crossTarget.classList.toggle('crossed', scratch.crossed.includes(word)); crossTarget.setAttribute('aria-pressed', String(scratch.crossed.includes(word))); return; }
  const voteTarget = e.target.closest('[data-spy-vote]'); if (voteTarget) { send({ type: 'vote-spy', gameId: currentGame.gameId, voteId: currentGame.vote.id, targetId: voteTarget.dataset.spyVote }); return; }
  if (action === "master") { showMaster = !showMaster; renderCodenames(currentGame, masterKeys); return; }
  if (action === "stop-city") { submitCity(); return; }
  if (action === "begin-code") { send({ type: "begin-code", gameId: currentGame.gameId }); return; }
  if (action === "new-code") { send({ type: "start-codenames" }); return; }
  if (action === "pass-code") { send({ type: "pass-code", turnId: currentGame.turnId }); return; }
  if (action === "pass-xox") { send({ type: currentGame.kind === "lol-xox" ? "pass-lol-xox" : "pass-xox", boardId: currentGame.boardId, turnId: currentGame.turnId }); return; }
  const codeTeam = e.target.closest("[data-code-team]"); if (codeTeam) { send({ type: "join-code-team", gameId: currentGame.gameId, team: codeTeam.dataset.codeTeam, role: codeTeam.dataset.codeRole }); return; }
  const review = e.target.closest("[data-city-review]"); if (review) { send({ type: "review-city", gameId: currentGame.gameId, targetId: review.dataset.cityReview, category: review.dataset.category, invalid: review.dataset.invalid !== "true" }); return; }
  if (action === "new-city") { send({ type: currentGame.match.finished ? "start-city" : "next-city", gameId: currentGame.gameId, restart: currentGame.match.finished }); return; }
  if (action === "new-xox") { if (currentGame.winner && !currentGame.series.finished) send({ type: "next-xox", boardId: currentGame.boardId }); else startXox(currentGame.mode, currentGame.series.finished); return; }
  if (action === "new-lol") { if (currentGame.winner && !currentGame.series.finished) send({ type: "next-lol-xox", boardId: currentGame.boardId }); else startLol(currentGame.mode, currentGame.series.finished); return; }
  if (action === "submit-city") { submitCity(); return; }
  const mode = e.target.closest("[data-xox-mode]")?.dataset.xoxMode; if (mode) { startXox(mode); return; }
  const cat = e.target.closest("[data-category]")?.dataset.category; if (cat) { selectedCategory = cat; renderSpySetup(); return; }
  const pick = e.target.closest("[data-pick]"); if (pick) { send({ type: "pick-word", index: Number(pick.dataset.pick), turnId: currentGame.turnId }); return; }
  const xoxCell = e.target.closest("[data-xox-cell]"); if (xoxCell) selectFootballer(xoxCell.dataset.xoxCell);
});

function startCity() { send({ type: "start-city" }); }
function captureCityDraft() { for (const input of $$('.city-field input')) cityDraft[input.name] = input.value; }
function renderCity(game) {
  if (cityDraftRound === game.gameId) captureCityDraft();
  else { cityDraft = { ...cityMine }; cityDraftRound = game.gameId; }
  const submitted = game.submittedIds?.includes(playerId);
  const participant = Object.hasOwn(game.names || {}, playerId);
  clearInterval(cityInterval);
  let body;
  if (game.phase === 'results') {
    const headers = '<th>Oyuncu</th>' + game.categories.map((cat) => '<th>' + escapeHTML(cat) + '</th>').join('') + '<th>Puan</th>';
    const rows = Object.entries(game.submissions).map(([id, answers]) => '<tr><th>' + escapeHTML(game.names[id]) + '</th>' + game.categories.map((cat) => '<td><button class="city-answer ' + (game.scores[id].cells[cat] ? '' : 'invalid-answer') + '" data-city-review="' + id + '" data-category="' + escapeHTML(cat) + '" data-invalid="' + Boolean(game.invalid?.[id]?.[cat]) + '" title="Geçerli / geçersiz işaretle"' + (!participant ? ' disabled' : '') + '>' + escapeHTML(answers[cat] || '—') + '<small>' + game.scores[id].cells[cat] + '</small></button></td>').join('') + '<td><b>' + game.scores[id].total + '</b></td></tr>').join('');
    body = '<div class="table-scroll"><table class="city-table"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div><p class="review-hint">Geçersiz cevabı puan dışı bırakmak için üzerine dokunun.</p><button class="start-button" data-action="new-city">' + (game.match.finished ? 'Yeni maç' : 'Sonraki tur') + '</button>';
  } else {
    const answers = submitted ? cityMine : cityDraft;
    body = '<div class="city-layout">' + game.categories.map((cat) => '<label class="city-field">' + escapeHTML(cat) + '<input name="' + escapeHTML(cat) + '" autocomplete="off" maxlength="48"' + (submitted || !participant ? ' disabled' : '') + ' value="' + escapeHTML(answers[cat] || '') + '"></label>').join('') + '</div><div class="active-foot"><span id="cityTimer"></span><button class="start-button" data-action="submit-city"' + (submitted || !participant ? ' disabled' : '') + '>' + (submitted ? 'Gönderildi' : 'Cevapları gönder') + '</button></div><p class="review-hint">' + game.submittedIds.length + '/' + Object.keys(game.names).length + ' gönderildi</p>';
  }
  $('#activeGame').innerHTML = gameHeader('İsim Şehir') + '<div class="chip">Tur ' + game.match.round + '/5</div>' + matchScores(game.names, game.match.totals, game.match.winners) + (game.match.finished ? '<h3 class="match-result">Maç bitti · ' + matchWinners(game.names, game.match.winners) + ' kazandı</h3>' : '') + '<div class="letter-card"><strong>' + escapeHTML(game.letter) + '</strong></div>' + body;
  if (game.phase === 'playing') {
    const clock = () => {
      const left = Math.max(0, Math.ceil((game.startedAt + game.duration * 1000 - Date.now()) / 1000));
      const el = $('#cityTimer'); if (el) el.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (!left) { for (const input of $$('.city-field input')) input.disabled = true; const button = $('[data-action="submit-city"]'); if (button) button.disabled = true; clearInterval(cityInterval); }
    };
    clock(); cityInterval = setInterval(clock, 1000);
  }
}
function submitCity() {
  if (currentGame?.kind !== 'city' || currentGame.phase !== 'playing') return;
  clearTimeout(citySaveTimer); captureCityDraft(); send({ type: 'submit-city', gameId: currentGame.gameId, answers: cityDraft });
}
$('#activeGame').addEventListener('input', (event) => {
  if (event.target.id === 'spyPrivateNote' && currentGame?.kind === 'spyfall') { loadSpyScratch(currentGame).note = event.target.value; saveSpyScratch(); return; }
  if (!event.target.closest('.city-field')) return;
  captureCityDraft(); clearTimeout(citySaveTimer);
  const gameId = currentGame.gameId;
  citySaveTimer = setTimeout(() => { if (currentGame?.gameId === gameId && currentGame.phase === 'playing') send({ type: 'save-city', gameId, answers: cityDraft }); }, 250);
});
$('#activeGame').addEventListener('submit', (event) => {
  if (event.target.id === 'spyGuessForm') { event.preventDefault(); send({ type: 'guess-spy', gameId: currentGame.gameId, location: new FormData(event.target).get('location') }); return; }
  if (event.target.id !== 'codeClueForm') return;
  event.preventDefault(); const form = new FormData(event.target);
  send({ type: 'code-clue', turnId: currentGame.turnId, word: form.get('word'), count: Number(form.get('count')) });
});

async function startXox(mode = currentGame?.mode || 'clubs', restart = false) {
  try {
    await loadFootballCatalog();
    send({ type: 'start-xox', mode, restart, boardId: currentGame?.boardId });
  } catch (error) { toast(error.message); if (!currentGame) renderGame(null); }
}
function teamSelect(id, axis, options) {
  const option = (item) => '<option value="' + item.id + '"' + (item.id === id ? ' selected' : '') + '>' + escapeHTML(item.name) + '</option>';
  const leagues = footballCatalog.leagues || [];
  const contents = leagues.length && options.some((item) => item.league)
    ? leagues.filter((league) => options.some((item) => item.league === league.id)).map((league) => '<optgroup label="' + escapeHTML(league.country + ' · ' + league.name) + '">' + options.filter((item) => item.league === league.id).map(option).join('') + '</optgroup>').join('')
    : options.map(option).join('');
  return '<select class="xox-team" data-axis="' + axis + '" aria-label="Takım veya ülke">' + contents + '</select>';
}
function renderXox() {
  if (!footballCatalog || (footballCatalog.version || footballCatalog.fetchedAt) !== currentGame.dataVersion) {
    $("#activeGame").innerHTML = gameHeader('Futbol XOX') + '<p>Yükleniyor…</p>';
    loadFootballCatalog(currentGame.dataVersion).then(() => { if (currentGame?.kind !== 'xox') return; if ((footballCatalog.version || footballCatalog.fetchedAt) !== currentGame.dataVersion) { $("#activeGame").innerHTML = gameHeader('Futbol XOX') + '<button class="start-button" data-action="new-xox">Yeni tahta</button>'; return; } renderXox(); }).catch((error) => toast(error.message));
    return;
  }
  const { top, side, topIds, sideIds, picks, mode } = currentGame;
  const canPick = !currentGame.winner && currentGame.teams?.[currentGame.turn]?.includes(playerId);
  const teams = xoxTeamChips(currentGame);
  const status = currentGame.winner ? currentGame.winner === 'draw' ? 'Berabere' : currentGame.winner + ' kazandı' : 'Sıra: ' + currentGame.turn;
  const turnBar = '<div class="code-score">' + teams + '<span class="chip">' + status + '</span>' + (!currentGame.winner ? '<b id="xoxTimer"></b>' : '') + '</div>'; 
  const header = '<div></div>' + top.map((t, i) => '<div class="xox-label">' + footballImage(topIds[i], 'football-logo') + '<span>' + escapeHTML(t) + '</span></div>').join('');
  const cells = side.map((team, r) => '<div class="xox-label">' + (mode !== 'countries' ? footballImage(sideIds[r], 'football-logo') : '') + '<span>' + escapeHTML(team) + '</span></div>' + top.map((colTeam, c) => {
    const key = r + '-' + c;
    return '<button class="xox-cell ' + (picks[key] ? 'filled owner-' + currentGame.owners?.[key] + (currentGame.winningLine?.includes(key) ? ' winning-cell' : '') : '') + '" data-xox-cell="' + key + '" aria-label="' + escapeHTML(team + ' ve ' + colTeam) + '"' + (picks[key] || !canPick ? ' disabled' : '') + '>' + (picks[key] && currentGame.pickedPlayerIds?.[key] ? footballImage(currentGame.pickedPlayerIds[key], 'player-photo') : '') + '<span>' + escapeHTML(picks[key] ? currentGame.owners[key] + ' · ' + picks[key] : '+') + '</span></button>';
  }).join('')).join('');
  const configure = !currentGame.series.history.length && !Object.keys(picks).length && !currentGame.winner;
  const seriesBar = '<div class="code-score"><span class="chip">Best of 3</span><span class="chip">X <b>' + currentGame.series.scores.X + '</b> – <b>' + currentGame.series.scores.O + '</b> O</span>' + (currentGame.series.finished ? '<span class="chip score-winner">Seriyi ' + currentGame.series.winner + ' kazandı</span>' : '') + '</div>';
  const nextButton = currentGame.winner ? '<button class="start-button" data-action="new-xox">' + (currentGame.series.finished ? 'Yeni seri' : currentGame.winner === 'draw' ? 'Tekrar oyna' : 'Sonraki tahta') + '</button>' : '';
  const modes = '<div class="category-row"><button class="category-chip ' + (mode === 'clubs' ? 'selected' : '') + '" data-xox-mode="clubs">Takım × Takım</button><button class="category-chip ' + (mode === 'countries' ? 'selected' : '') + '" data-xox-mode="countries">Takım × Ülke</button><button class="category-chip ' + (mode === 'superlig' ? 'selected' : '') + '" data-xox-mode="superlig">Sadece Süper Lig</button></div>';
  const selectableClubs = mode === 'superlig' ? footballCatalog.clubs.filter((club) => club.league === 'turkey') : footballCatalog.clubs;
  const settings = '<details><summary>Seçimleri değiştir</summary><div class="xox-settings"><div><label>Sütunlar</label><div class="category-row">' + topIds.map((id, i) => teamSelect(id, 'top-' + i, selectableClubs)).join('') + '</div></div><div><label>Satırlar</label><div class="category-row">' + sideIds.map((id, i) => teamSelect(id, 'side-' + i, mode === 'countries' ? footballCatalog.countries : selectableClubs)).join('') + '</div></div></div></details>';
  $("#activeGame").innerHTML = gameHeader("Futbol XOX") + seriesBar + (configure ? modes : "") + turnBar + '<div class="xox-board">' + header + cells + '</div><div class="active-foot">' + (canPick ? '<button class="subtle-button" data-action="pass-xox">Pas geç</button>' : '') + nextButton + '</div>' + (configure ? settings : '') + '<details class="media-credits"><summary>Veri kaynakları</summary><p>Sezon ' + escapeHTML(footballCatalog.season || '') + ' · Kadrolar: ' + escapeHTML(footballCatalog.seasonCheckedAt?.slice(0, 10) || '') + '.</p><p><a href="https://www.wikidata.org/" target="_blank" rel="noopener noreferrer">Wikidata</a> (CC0) ve <a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia katkıda bulunanları</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>). Kadro ve kariyer kayıtları birleştirildi. Güncel A takım kadrosundaki oyuncular da kabul edilir.</p></details>' + '<details id="footballMediaCredits" class="media-credits hidden"><summary>Görsel kaynakları</summary><div id="footballMediaCreditList"></div></details>';
  hydrateFootballMedia();
  clearInterval(xoxInterval);
  if (!currentGame.winner) {
    const clock = () => {
      if (currentGame?.kind !== 'xox') return;
      const left = Math.max(0, Math.ceil((currentGame.deadline - Date.now()) / 1000));
      const el = $('#xoxTimer'); if (el) el.textContent = left + ' sn';
      if (!left) { $('#playerDialog').close(); for (const button of $$('[data-xox-cell]')) button.disabled = true; }
    };
    clock(); xoxInterval = setInterval(clock, 250);
  }
  $$(".xox-team").forEach((sel) => sel.addEventListener("change", () => {
    const [axis, n] = sel.dataset.axis.split("-");
    const changedTop = [...topIds], changedSide = [...sideIds];
    (axis === "top" ? changedTop : changedSide)[Number(n)] = sel.value;
    send({ type: 'start-xox', mode, topIds: changedTop, sideIds: changedSide });
  }));
}
async function startLol(mode = 'mixed', restart = false) {
  try { await loadLolCatalog(); send({ type: 'start-lol-xox', mode, restart, boardId: currentGame?.boardId }); }
  catch (error) { toast(error.message); if (!currentGame) renderGame(null); }
}
function renderLol() {
  const game = currentGame;
  if (!lolCatalog || lolCatalog.version !== game.dataVersion) {
    $('#activeGame').innerHTML = gameHeader('LoL XOX') + '<p>Yükleniyor…</p>';
    loadLolCatalog(game.dataVersion).then(() => {
      if (currentGame?.kind !== 'lol-xox' || currentGame.boardId !== game.boardId) return;
      if (lolCatalog.version !== game.dataVersion) { $('#activeGame').innerHTML = gameHeader('LoL XOX') + '<p>Şampiyon verisi yenilendi. Oyun menüsünden yeni seri başlat.</p>'; return; }
      renderLol();
    }).catch((error) => toast(error.message));
    return;
  }
  const typeLabels = { region: ['Bölge', 'Region'], origin: ['Köken', 'Origin'], species: ['Tür', 'Species'], lane: ['Koridor', 'Lane'], class: ['Sınıf', 'Class'] };
  const attributes = new Map(lolCatalog.attributes.map((attribute) => [attribute.id, attribute]));
  const champions = new Map(lolCatalog.champions.map((champion) => [champion.id, champion]));
  const label = (id) => { const attribute = attributes.get(id), type = typeLabels[attribute.type]; return '<div class="xox-label lol-label"><small>' + type[0] + '<span class="lol-type-en" lang="en">(' + type[1] + ')</span></small><span>' + escapeHTML(attribute.label) + (attribute.englishLabel ? '<span class="lol-original" lang="en">(' + escapeHTML(attribute.englishLabel) + ')</span>' : '') + '</span></div>'; };
  const canPick = !game.winner && game.teams[game.turn].includes(playerId);
  const participant = Object.values(game.teams).flat().includes(playerId);
  const cells = game.sideIds.map((id, row) => label(id) + game.topIds.map((top, column) => {
    const key = row + '-' + column, picked = game.picks[key], champion = champions.get(game.pickedChampionIds?.[key]);
    return '<button class="xox-cell ' + (picked ? 'filled owner-' + game.owners[key] : '') + (game.winningLine?.includes(key) ? ' winning-cell' : '') + '" data-xox-cell="' + key + '" aria-label="' + escapeHTML(game.side[row] + ' ve ' + game.top[column]) + '"' + (picked || !canPick ? ' disabled' : '') + '>' + (champion ? '<img class="lol-photo" src="' + escapeHTML(champion.icon) + '" width="48" height="48" alt="" referrerpolicy="no-referrer">' : '') + '<span>' + escapeHTML(picked ? game.owners[key] + ' · ' + picked : '+') + '</span></button>';
  }).join('')).join('');
  const teams = xoxTeamChips(game);
  const status = game.winner ? game.winner === 'draw' ? 'Berabere' : game.winner + ' kazandı' : 'Sıra: ' + game.turn;
  const configure = participant && !game.series.history.length && !Object.keys(game.picks).length && !game.winner;
  const mode = configure ? '<select id="lolMode" aria-label="Tahta türü">' + lolCatalog.modes.map((mode) => '<option value="' + mode.id + '"' + (mode.id === game.mode ? ' selected' : '') + '>' + escapeHTML(mode.label) + '</option>').join('') + '</select>' : '';
  const footer = (canPick ? '<button class="subtle-button" data-action="pass-xox">Pas geç</button>' : '') + (game.winner && participant ? '<button class="start-button" data-action="new-lol">' + (game.series.finished ? 'Yeni seri' : game.winner === 'draw' ? 'Tekrar oyna' : 'Sonraki tahta') + '</button>' : '');
  const credits = '<details class="media-credits"><summary>Kaynaklar</summary><p>Şampiyonlar, sınıflar ve görseller: <a href="https://developer.riotgames.com/docs/lol#data-dragon" target="_blank" rel="noopener noreferrer">Riot Data Dragon</a> · ' + escapeHTML(lolCatalog.patch) + '. Bölge, köken, tür ve koridorlar: <a href="https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data" target="_blank" rel="noopener noreferrer">LoL Wiki</a> ve <a href="https://wiki.leagueoflegends.com/en-us/Universe:Main_Page" target="_blank" rel="noopener noreferrer">karakter biyografileri</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>; çeviri ve tür gruplaması uygulandı).</p><p>Bölge güncel bağlılığı, köken doğum yerini belirtir. Türlerde üst gruplar kullanılır; eski türler sayılmaz. Koridorlar Wiki’nin önerilen listesidir.</p></details><p class="riot-credit">Riot Games tarafından onaylanmamıştır. League of Legends ve ilgili görseller Riot Games’e aittir.</p>';
  $('#activeGame').innerHTML = gameHeader('LoL XOX') + '<div class="code-score"><span class="chip">Best of 3</span><span class="chip">X <b>' + game.series.scores.X + '</b> – <b>' + game.series.scores.O + '</b> O</span>' + (game.series.finished ? '<span class="chip score-winner">Seriyi ' + game.series.winner + ' kazandı</span>' : '') + '</div>' + mode + '<div class="code-score lol-turn">' + teams + '<span class="chip">' + status + '</span>' + (!game.winner ? '<b id="xoxTimer"></b>' : '') + '</div><div class="xox-board"><div></div>' + game.topIds.map(label).join('') + cells + '</div><div class="active-foot">' + footer + '</div>' + credits;
  $('#lolMode')?.addEventListener('change', (event) => startLol(event.target.value));
  for (const image of $$('.lol-photo')) image.addEventListener('error', () => { image.hidden = true; }, { once: true });
  clearInterval(xoxInterval);
  if (!game.winner) {
    const clock = () => {
      if (currentGame?.kind !== 'lol-xox') return;
      const left = Math.max(0, Math.ceil((currentGame.deadline - Date.now()) / 1000)); const el = $('#xoxTimer'); if (el) el.textContent = left + ' sn';
      if (!left) { $('#playerDialog').close(); for (const button of $$('[data-xox-cell]')) button.disabled = true; }
    };
    clock(); xoxInterval = setInterval(clock, 250);
  }
}

const footballMedia = new Map();
const footballMediaPending = new Set();
function footballImage(id, className) {
  if (!/^Q\d+$/.test(id || '')) return '';
  return '<img class="' + className + '" data-football-image="' + id + '" width="48" height="48" alt="" decoding="async" referrerpolicy="no-referrer" hidden>';
}
function paintFootballMedia() {
  const visible = new Map();
  for (const img of $$('#activeGame [data-football-image]')) {
    const id = img.dataset.footballImage;
    const media = footballMedia.get(id);
    if (!media?.src) continue;
    visible.set(id, media);
    if (!img.getAttribute('src')) {
      img.title = media.author + ' · ' + media.license;
      img.addEventListener('load', () => { img.hidden = false; }, { once: true });
      img.addEventListener('error', () => { img.hidden = true; }, { once: true });
      img.src = media.src;
    }
  }
  const credits = $('#footballMediaCredits');
  const list = $('#footballMediaCreditList');
  if (credits && list) {
    credits.classList.toggle('hidden', !visible.size);
    list.innerHTML = [...visible.values()].map((m) => '<p><a href="' + escapeHTML(m.source) + '" target="_blank" rel="noopener noreferrer">Kaynak</a> · ' + escapeHTML(m.author) + ' · ' + (m.licenseUrl ? '<a href="' + escapeHTML(m.licenseUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(m.license) + '</a>' : escapeHTML(m.license)) + '</p>').join('');
  }
}
function hydrateFootballMedia() {
  paintFootballMedia();
  const missing = [...new Set($$('#activeGame [data-football-image]').map((img) => img.dataset.footballImage))].filter((id) => !footballMedia.has(id) && !footballMediaPending.has(id));
  for (let offset = 0; offset < missing.length; offset += 8) {
    const batch = missing.slice(offset, offset + 8);
    batch.forEach((id) => footballMediaPending.add(id));
    fetch('/api/football/media?ids=' + batch.join(',')).then(async (response) => {
      if (!response.ok) throw new Error('Media unavailable');
      const data = await response.json();
      for (const id of batch) footballMedia.set(id, data.items?.[id] || null);
    }).catch(() => { for (const id of batch) footballMedia.set(id, null); }).finally(() => {
      batch.forEach((id) => footballMediaPending.delete(id));
      paintFootballMedia();
    });
  }
}
let selectedXoxCell = null, selectedXoxBoard = null, selectedXoxTurn = null, selectedXoxKind = null;
function selectFootballer(key) {
  if (!isGridGame(currentGame) || currentGame.picks[key] || currentGame.winner || !currentGame.teams?.[currentGame.turn]?.includes(playerId) || Date.now() >= currentGame.deadline) return;
  selectedXoxCell = key; selectedXoxBoard = currentGame.boardId; selectedXoxTurn = currentGame.turnId; selectedXoxKind = currentGame.kind;
  const lol = currentGame.kind === 'lol-xox';
  $('#playerDialog h2').textContent = lol ? 'Şampiyon seç' : 'Futbolcu seç';
  $('#playerSearch').placeholder = lol ? 'Şampiyon ara' : 'Futbolcu ara';
  $('#playerSearch').setAttribute('aria-label', lol ? 'Şampiyon ara' : 'Futbolcu ara');
  $("#playerSearch").value = '';
  renderPlayerResults();
  $("#playerDialog").showModal();
  $("#playerSearch").focus();
}
let searchSequence = 0, searchTimer = null, searchController = null;
async function renderPlayerResults() {
  const query = $("#playerSearch").value.trim();
  const sequence = ++searchSequence;
  searchController?.abort();
  if (!query) { $("#playerResults").innerHTML = ''; return; }
  searchController = new AbortController();
  $("#playerResults").innerHTML = '<p class="empty-results">Aranıyor…</p>';
  try {
    const response = await fetch((currentGame?.kind === 'lol-xox' ? '/api/lol/search?q=' : '/api/football/search?q=') + encodeURIComponent(query) + '&v=' + encodeURIComponent(currentGame?.dataVersion || ''), { signal: searchController.signal });
    if (!response.ok) throw new Error('Arama yüklenemedi.');
    const data = await response.json();
    if (sequence !== searchSequence) return;
    $("#playerResults").innerHTML = data.players.map((p) => '<button type="button" class="player-result" data-player="' + escapeHTML(p.id) + '">' + escapeHTML(p.name) + '</button>').join('') || '<p class="empty-results">Sonuç bulunamadı.</p>';
  } catch (error) {
    if (error.name !== 'AbortError' && sequence === searchSequence) $("#playerResults").innerHTML = '<p class="empty-results">Arama yüklenemedi. Tekrar dene.</p>';
  }
}
$("#playerSearch").addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderPlayerResults, 180); });
$("#playerDialog").addEventListener('close', () => { clearTimeout(searchTimer); searchSequence++; searchController?.abort(); });
$("#playerSearchForm").addEventListener('submit', (event) => event.preventDefault());
$("#closePlayerDialog").onclick = () => $("#playerDialog").close();
$("#playerResults").addEventListener('click', (event) => {
  const playerId = event.target.closest('[data-player]')?.dataset.player;
  if (!playerId || !selectedXoxCell || !isGridGame(currentGame) || currentGame.kind !== selectedXoxKind || currentGame.boardId !== selectedXoxBoard || currentGame.turnId !== selectedXoxTurn) return;
  send({ type: currentGame.kind === 'lol-xox' ? 'pick-lol-xox' : 'pick-xox', key: selectedXoxCell, ...(currentGame.kind === 'lol-xox' ? { championId: playerId } : { playerId }), boardId: selectedXoxBoard, turnId: selectedXoxTurn });
});


const inviteCode = new URLSearchParams(location.search).get("oda");
if (inviteCode) { $("#joinCode").value = inviteCode.toUpperCase(); setTab("join"); $("#joinPassword").focus(); }
