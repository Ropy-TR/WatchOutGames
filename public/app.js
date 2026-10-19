const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const categories = ["Dünyadan yerler", "Ülkeler", "Hayvanlar", "Futbol takımları", "Futbolcular"];
const cityCategories = ["İsim", "Şehir", "Ülke", "Hayvan", "Bitki", "Yemek", "Eşya", "Ünlü"];
const teams = ["Real Madrid", "Barcelona", "Liverpool", "Manchester City", "Manchester United", "Arsenal", "Chelsea", "Bayern Münih", "Juventus", "Milan", "Inter", "PSG", "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor"];
const footballers = [
  { name: "Cristiano Ronaldo", teams: ["Real Madrid", "Manchester United", "Juventus"] }, { name: "Lionel Messi", teams: ["Barcelona", "PSG"] },
  { name: "Neymar", teams: ["Barcelona", "PSG"] }, { name: "Luis Suárez", teams: ["Barcelona", "Liverpool"] },
  { name: "Xabi Alonso", teams: ["Real Madrid", "Liverpool", "Bayern Münih"] }, { name: "Thiago Alcântara", teams: ["Barcelona", "Liverpool", "Bayern Münih"] },
  { name: "Zlatan Ibrahimović", teams: ["Barcelona", "PSG", "Milan", "Inter", "Manchester United"] }, { name: "David Beckham", teams: ["Real Madrid", "Manchester United", "Milan", "PSG"] },
  { name: "Ángel Di María", teams: ["Real Madrid", "Manchester United", "PSG", "Juventus"] }, { name: "Alexis Sánchez", teams: ["Barcelona", "Arsenal", "Manchester United", "Inter"] },
  { name: "Cesc Fàbregas", teams: ["Barcelona", "Arsenal", "Chelsea"] }, { name: "Samuel Eto'o", teams: ["Barcelona", "Inter", "Chelsea"] },
  { name: "Arda Turan", teams: ["Barcelona", "Galatasaray"] }, { name: "Wesley Sneijder", teams: ["Real Madrid", "Inter", "Galatasaray"] },
  { name: "Didier Drogba", teams: ["Chelsea", "Galatasaray"] }, { name: "Mesut Özil", teams: ["Real Madrid", "Arsenal"] },
  { name: "Robin van Persie", teams: ["Arsenal", "Manchester United"] }, { name: "Gerard Piqué", teams: ["Barcelona", "Manchester United"] },
  { name: "Thierry Henry", teams: ["Barcelona", "Arsenal"] }, { name: "Sadio Mané", teams: ["Liverpool", "Bayern Münih"] },
  { name: "Philippe Coutinho", teams: ["Barcelona", "Liverpool", "Bayern Münih"] }, { name: "Ousmane Dembélé", teams: ["Barcelona", "PSG"] },
  { name: "Hakan Çalhanoğlu", teams: ["Milan", "Inter"] }, { name: "Andrea Pirlo", teams: ["Milan", "Inter", "Juventus"] },
  { name: "Ronaldo Nazário", teams: ["Real Madrid", "Barcelona", "Inter", "Milan"] }, { name: "Zinédine Zidane", teams: ["Real Madrid", "Juventus"] },
  { name: "Kaká", teams: ["Real Madrid", "Milan"] }, { name: "Rivaldo", teams: ["Barcelona", "Milan"] },
  { name: "Fernando Torres", teams: ["Liverpool", "Chelsea", "Milan"] }, { name: "Raheem Sterling", teams: ["Liverpool", "Manchester City", "Chelsea"] },
  { name: "Ilkay Gündoğan", teams: ["Manchester City", "Barcelona"] },
  { name: "Carlos Tévez", teams: ["Manchester United", "Manchester City", "Juventus"] }, { name: "Paul Pogba", teams: ["Manchester United", "Juventus"] },
  { name: "Romelu Lukaku", teams: ["Manchester United", "Chelsea", "Inter"] }, { name: "Juan Mata", teams: ["Manchester United", "Chelsea"] },
  { name: "Henrik Larsson", teams: ["Barcelona", "Manchester United"] }, { name: "Dani Alves", teams: ["Barcelona", "Juventus", "PSG"] }
];

let socket = null, current = null, playerId = localStorage.getItem("wg-player-id"), roomPass = "", myRole = null, currentGame = null, masterKeys = null, timerInterval = null, toastTimeout;
let selectedCategory = categories[0], showMaster = false, cityStartedAt = 0, cityLetter = "", cityInterval = null;

function toast(text) { const el = $("#toast"); el.textContent = text; el.classList.add("show"); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove("show"), 2600); }
function notice(text) { const n = $("#roomNotice"); n.textContent = text; n.classList.toggle("hidden", !text); }
function setTab(tab) { $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab)); $("#joinForm").classList.toggle("hidden", tab !== "join"); $("#createForm").classList.toggle("hidden", tab !== "create"); }
$(".tab-row").addEventListener("click", (e) => { const tab = e.target.closest(".tab"); if (tab) setTab(tab.dataset.tab); });

$("#createForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const password = $("#createPassword").value.trim(), nickname = $("#createNickname").value.trim();
  if (password.length < 1) return toast("Bir oda şifresi belirle.");
  try { const res = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Oda oluşturulamadı."); connect(data.code, password, nickname); }
  catch (err) { toast(err.message || "Sunucuya ulaşılamadı."); }
});
$("#joinForm").addEventListener("submit", (e) => { e.preventDefault(); connect($("#joinCode").value.trim().toUpperCase(), $("#joinPassword").value, $("#joinNickname").value.trim()); });

function connect(code, password, nickname) {
  if (!/^[A-Z0-9]{5}$/.test(code)) return toast("5 karakterli oda kodunu kontrol et.");
  roomPass = password; current = { code, nickname }; myRole = null;
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${scheme}://${location.host}/api/rooms/${code}/socket`);
  socket.onopen = () => socket.send(JSON.stringify({ type: "join", password, nickname, playerId }));
  socket.onmessage = (event) => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === "error") { toast(msg.message); return; }
    if (msg.type === "joined") { playerId = msg.playerId; localStorage.setItem("wg-player-id", playerId); showRoom(code, msg.room); if (msg.room.game) renderGame(msg.room.game); }
    if (msg.type === "room") updatePlayers(msg.room);
    if (msg.type === "role") { myRole = msg.role; if (currentGame?.kind === "spyfall") renderGame(currentGame); }
    if (msg.type === "game") { myRole = null; if (msg.game) { currentGame = msg.game; showMaster = Boolean(msg.master); if (Array.isArray(msg.master)) masterKeys = msg.master; if (msg.game.kind !== "codenames") masterKeys = null; } else { currentGame = null; myRole = null; masterKeys = null; } renderGame(msg.game, msg.master); }
  };
  socket.onclose = () => { if (current) toast("Oda bağlantısı kesildi."); };
  socket.onerror = () => toast("Oda bağlantısı kurulamadı.");
}
function showRoom(code, room) { $("#landing").classList.add("hidden"); $(".games-overview").classList.add("hidden"); $("#room").classList.remove("hidden"); $("#roomCodeLabel").textContent = code; updatePlayers(room); notice(""); window.scrollTo(0, 0); }
function updatePlayers(room) { const players = room?.players || []; $("#playerCount").textContent = `${players.length} / 8`; $("#playerList").innerHTML = players.map((p, i) => `<div class="player"><span class="player-avatar">${escapeHTML(p.nickname.slice(0,1).toUpperCase())}</span><span>${escapeHTML(p.nickname)}</span>${p.id === playerId ? '<span class="you-tag">SEN</span>' : ""}</div>`).join(""); }
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function send(obj) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj)); else toast("Oda bağlantısı yok."); }
function copy(value, message) { navigator.clipboard?.writeText(value).then(() => toast(message)).catch(() => toast(value)); }
$("#copyCode").onclick = () => copy(current.code, "Oda kodu kopyalandı.");
$("#shareRoom").onclick = () => copy(`${location.origin}/?oda=${current.code}`, "Davet bağlantısı kopyalandı. Şifreyi ayrıca paylaş.");
$("#leaveRoom").onclick = () => { current = null; socket?.close(); socket = null; clearInterval(timerInterval); clearInterval(cityInterval); $("#room").classList.add("hidden"); $("#landing").classList.remove("hidden"); $(".games-overview").classList.remove("hidden"); $("#activeGame").classList.add("hidden"); $("#gamePicker").classList.remove("hidden"); window.scrollTo(0, 0); };

$$(".picker-card").forEach((card) => card.addEventListener("click", () => startGameMenu(card.dataset.game)));
function startGameMenu(kind) {
  notice(""); $("#gamePicker").classList.add("hidden"); const view = $("#activeGame"); view.classList.remove("hidden");
  if (kind === "spy") renderSpySetup(); else if (kind === "code") send({ type: "start-codenames" }); else if (kind === "city") startCity(); else if (kind === "xox") startXox();
}
function gameHeader(title, subtitle, kicker = "OYUN MASASI") { return `<div class="game-title-row"><div><span class="section-kicker">${kicker}</span><h2>${title}</h2><p>${subtitle}</p></div><button class="subtle-button" data-action="menu">✕ Menü</button></div>`; }
function renderSpySetup() {
  currentGame = { kind: "spyfall-setup" };
  $("#activeGame").innerHTML = gameHeader("Spyfall", "Kategori seçin, casusu bulmaya hazır olun.") + `<div class="spy-meta"><span class="chip">3–8 OYUNCU</span><span class="chip">8 DAKİKA</span><span class="chip">RASTGELE ROL</span></div><p style="font-size:10px;color:#777;margin:21px 0 9px">KATEGORİ</p><div class="category-row">${categories.map((c) => `<button class="category-chip ${c === selectedCategory ? "selected" : ""}" data-category="${c}">${c}</button>`).join("")}</div><div class="spy-role" style="background:#f6f5ef;color:#4c4b43"><div class="role-symbol" style="color:#d2b11e">◉</div><h3 style="font-size:15px">Rolün gizli kalacak</h3><p style="color:#85837a">Her oyuncu rolünü yalnızca kendi ekranında görür.</p></div><button class="start-button" data-action="start-spy">Turu başlat ↗</button>`;
}
function renderSpy(game) {
  const role = myRole;
  if (!role) return;
  clearInterval(timerInterval);
  const end = game.startedAt + game.duration * 1000;
  const clock = () => { const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000)); const t = $("#spyTimer"); if (t) t.textContent = `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; };
  const roleMarkup = role.spy ? `<div class="role-symbol">◉</div><h3>Sen casussun!</h3><p>Diğerlerinin nerede olduğunu anlamaya çalış. Dikkat çekmeden sorular sor.</p>` : `<div class="role-symbol">⌖</div><h3>${escapeHTML(role.location)}</h3><p>Konumunu açık etmeden casusu bul. Diğer oyunculara sorular sor.</p>`;
  $("#activeGame").innerHTML = gameHeader("Spyfall", `Tur ${game.round} · ${game.players?.length || ""} oyuncu · ${escapeHTML(game.category)}`) + `<div class="spy-meta"><span class="chip">${escapeHTML(game.category)}</span><span class="chip">TUR ${game.round}</span></div><div class="spy-role ${role.spy ? "role-spy" : ""}">${roleMarkup}</div><div class="spy-tools"><div class="timer" id="spyTimer">08:00<small>KALAN SÜRE</small></div><button class="start-button" data-action="next-spy">Yeni tur ↻</button></div><p style="font-size:9px;color:#8c8a81;line-height:1.7;margin-top:17px">İpucu: Bir oyuncuya bulunduğunuz yerle ilgili dolaylı bir soru sor. Çok açık cevaplar casusu ele verebilir.</p>`;
  clock(); timerInterval = setInterval(clock, 1000);
}
function renderCodenames(game, master) {
  const done = game.winner ? `<div class="notice">${game.winner === "red" ? "Kırmızı" : "Mavi"} takım kazandı! Yeni tur için menüden Codenames'i yeniden başlatın.</div>` : "";
  $("#activeGame").innerHTML = gameHeader("Codenames", game.winner ? "Tur tamamlandı." : "Takımının ajanlarını bul. Suikastçıya basma!") + done + `<div class="code-score"><span class="score-pill red">● Kırmızı ${game.scores.red}</span><span class="score-pill blue">● Mavi ${game.scores.blue}</span><span class="chip">${game.turn === "red" ? "KIRMIZI" : "MAVİ"} TAKIMIN SIRASI</span></div><div class="game-grid">${game.words.map((word, i) => { const revealed = game.revealed.includes(i); const key = master?.[i]; const extra = revealed ? (key === "red" ? "red" : key === "blue" ? "blue" : key === "assassin" ? "assassin" : "revealed") : (!revealed && showMaster ? (key === "red" ? "master-red" : key === "blue" ? "master-blue" : key === "assassin" ? "master-assassin" : "") : ""); return `<button class="word-card ${extra}" data-pick="${i}" ${revealed || game.winner ? "disabled" : ""}>${escapeHTML(word)}</button>`; }).join("")}</div><div class="active-foot"><span>${showMaster ? "Spymaster görünümü açık" : "Kelimeye dokununca açılır"}</span><button class="subtle-button" data-action="master">${showMaster ? "Anahtarı gizle" : "Spymaster anahtarı"}</button></div>`;
}
function renderGame(game, master) {
  if (!game) { $("#activeGame").classList.add("hidden"); $("#gamePicker").classList.remove("hidden"); clearInterval(timerInterval); return; }
  $("#gamePicker").classList.add("hidden"); $("#activeGame").classList.remove("hidden"); currentGame = game;
  if (game.kind === "spyfall") { if (myRole) renderSpy(game); else $("#activeGame").innerHTML = gameHeader("Spyfall", "Rolün hazırlanıyor…") + `<div class="spy-role"><p>Gizli rol yükleniyor. Birkaç saniye bekle.</p></div>`; }
  if (game.kind === "codenames") renderCodenames(game, masterKeys || master);
  if (game.kind === "city") renderCity(game);
  if (game.kind === "xox") { currentGame = game; renderXox(); }
}
$("#activeGame").addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "menu") { send({ type: "stop-game" }); return; }
  if (action === "start-spy") { send({ type: "start-spyfall", category: selectedCategory }); return; }
  if (action === "next-spy") { send({ type: "start-spyfall", category: currentGame.category }); return; }
  if (action === "master") { showMaster = !showMaster; renderCodenames(currentGame, masterKeys); return; }
  if (action === "stop-city") { submitCity(); return; }
  if (action === "new-city") { send({ type: "start-city" }); return; }
  if (action === "new-xox") { startXox(); return; }
  if (action === "submit-city") { submitCity(); return; }
  const cat = e.target.closest("[data-category]")?.dataset.category; if (cat) { selectedCategory = cat; renderSpySetup(); return; }
  const pick = e.target.closest("[data-pick]"); if (pick) { send({ type: "pick-word", index: Number(pick.dataset.pick) }); return; }
  const cityStop = e.target.closest("[data-city-stop]"); if (cityStop) stopCity();
  const xoxCell = e.target.closest("[data-xox-cell]"); if (xoxCell) selectFootballer(xoxCell.dataset.xoxCell);
});

function startCity() { send({ type: "start-city" }); }
function renderCity(game) {
  currentGame = game; cityLetter = game.letter;
  const me = game.submissions?.[current.nickname]; const remaining = Math.max(0, Math.ceil((game.startedAt + game.duration * 1000 - Date.now()) / 1000));
  const fields = game.categories.map((cat) => `<div class="city-field"><label>${cat.toLocaleUpperCase("tr-TR")}</label><input name="${escapeHTML(cat)}" autocomplete="off" ${me || !remaining ? "disabled" : ""} value="${escapeHTML(me?.[cat] || "")}" /></div>`).join("");
  const submissions = Object.entries(game.submissions || {}).map(([name, answers]) => `<div class="submission"><b>${escapeHTML(name)}</b><div>${game.categories.map((cat) => answers[cat] ? `<span>${escapeHTML(cat)}: ${escapeHTML(answers[cat])}</span>` : "").join("")}</div></div>`).join("");
  $("#activeGame").innerHTML = gameHeader("İsim Şehir", `${Object.keys(game.submissions || {}).length} oyuncu cevaplarını gönderdi · herkesin yanıtı odada görünür.`) + `<div class="letter-card"><strong>${game.letter}</strong><span>BU HARFLE BAŞLAYAN CEVAPLAR BUL</span><button class="start-button" style="margin-left:auto" data-action="submit-city" ${me || !remaining ? "disabled" : ""}>${me ? "Gönderildi ✓" : "Cevapları gönder"}</button></div>${remaining ? `<div class="city-layout">${fields}</div>` : `<div class="city-results">${submissions || "Henüz cevap yok."}</div>`}<div class="active-foot"><span>Doğru ve benzersiz cevap 10 puan. Puanları birlikte karşılaştırın.</span><span id="cityTimer">${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}</span></div>${remaining ? "" : `<div class="active-foot"><button class="subtle-button" data-action="new-city">Yeni harf ↻</button></div>`}`;
  clearInterval(cityInterval);
  if (remaining) cityInterval = setInterval(() => { const left = Math.max(0, Math.ceil((game.startedAt + game.duration * 1000 - Date.now()) / 1000)); const el = $("#cityTimer"); if (el) el.textContent = `${String(Math.floor(left / 60)).padStart(2,"0")}:${String(left % 60).padStart(2,"0")}`; if (!left) renderCity(currentGame); }, 1000);
}
function submitCity() { if (!currentGame || currentGame.kind !== "city") return; const answers = Object.fromEntries($$(".city-field input").map((input) => [input.name, input.value])); send({ type: "submit-city", answers }); }

function startXox() {
  const top = ["Liverpool", "Barcelona", "Manchester United"];
  const side = ["Real Madrid", "PSG", "Milan"];
  const selects = (values, id) => `<select class="xox-team" data-axis="${id}">${teams.map((team) => `<option ${values.includes(team) ? "selected" : ""}>${team}</option>`).join("")}</select>`;
  send({ type: "start-xox", top, side });
}
function renderXox() {
  const { top, side, picks } = currentGame;
  const markup = `<div class="xox-board">${side.map((rowTeam, r) => top.map((colTeam, c) => { const key = `${r}-${c}`; return `<button class="xox-cell" data-xox-cell="${key}"><small>${escapeHTML(rowTeam)} × ${escapeHTML(colTeam)}</small><b>${picks[key] ? escapeHTML(picks[key]) : "+ Futbolcu seç"}</b></button>`; }).join("")).join("")}</div>`;
  $("#activeGame").innerHTML = gameHeader("Futbol XOX", "Satır ve sütun takımında da oynamış futbolcuyu bul.", "KARİYER KESİŞİMİ") + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px"><div><label style="font:500 8px 'DM Mono';color:#888">ÜSTTEKİ TAKIMLAR · 3 SÜTUN</label><div class="category-row">${top.map((t,i)=>selects([t],`top-${i}`)).join("")}</div></div><div><label style="font:500 8px 'DM Mono';color:#888">SOLDAKİ TAKIMLAR · 3 SATIR</label><div class="category-row">${side.map((t,i)=>selects([t],`side-${i}`)).join("")}</div></div></div>${markup}<div class="xox-examples">Kariyer örneklerinden oluşan sınırlı başlangıç havuzu · Futbolcu seçmek için hücreye dokun.</div><div class="active-foot"><button class="subtle-button" data-action="new-xox">Yeni tahta ↻</button><span>Örn. Cristiano Ronaldo: Real Madrid × Manchester United</span></div>`;
  $$(".xox-team").forEach((sel) => sel.addEventListener("change", () => { const [axis, n] = sel.dataset.axis.split("-"); const index = Number(n); if (axis === "top") top[index] = sel.value; else side[index] = sel.value; send({ type: "start-xox", top, side }); }));
}
function selectFootballer(key) {
  const [r, c] = key.split("-").map(Number), a = currentGame.side[r], b = currentGame.top[c];
  const valid = footballers.filter((p) => p.teams.includes(a) && p.teams.includes(b));
  if (!valid.length) return toast("Bu iki takım için örnek havuzunda eşleşme yok. Takımları değiştir.");
  const name = prompt(`${a} ve ${b} forması giymiş futbolcu hangisi?\nÖrnek: ${valid.slice(0,3).map((p)=>p.name).join(", ")}`);
  if (!name) return;
  const player = valid.find((p) => p.name.toLocaleLowerCase("tr").includes(name.trim().toLocaleLowerCase("tr")));
  if (!player) return toast("Bu futbolcu başlangıç havuzunda bu iki takım için görünmüyor.");
  currentGame.picks[key] = player.name; send({ type: "pick-xox", key, name: player.name }); toast(`Doğru: ${player.name}!`);
}

$("#soundToggle").onclick = () => toast("Oyun sesleri henüz kapalı.");
const inviteCode = new URLSearchParams(location.search).get("oda");
if (inviteCode) { $("#joinCode").value = inviteCode.toUpperCase(); setTab("join"); $("#joinPassword").focus(); }
