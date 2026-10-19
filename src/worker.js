const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
});

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const roomCode = code();
      const id = env.ROOMS.idFromName(roomCode);
      const room = env.ROOMS.get(id);
      const body = await request.json();
      const result = await room.fetch("https://room/init", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
      });
      if (!result.ok) return result;
      return json({ code: roomCode });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})(?:\/socket)?$/i);
    if (match) {
      const id = env.ROOMS.idFromName(match[1].toUpperCase());
      return env.ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

const SPY_LOCATIONS = {
  "Dünyadan yerler": ["Uzay istasyonu", "Korsan gemisi", "Büyük kütüphane", "Gece treni", "Kutup araştırma üssü", "Lunapark", "Lüks otel", "Film seti", "Yeraltı sığınağı", "Müzayede salonu", "Denizaltı", "Dağ teleferiği", "Havaalanı", "Japon hamamı", "Mısır piramidi", "Venedik kanalı", "Sahra çölü", "Terk edilmiş fabrika", "Yat limanı", "Mahkeme salonu", "Sirk çadırı", "Robot laboratuvarı", "Kamp alanı", "Uzaylı elçiliği", "Kış sarayı", "Orman kulübesi", "Gizli ajan üssü", "Akşam pazarı", "Düğün salonu", "Sualtı oteli"],
  "Ülkeler": ["Türkiye", "Japonya", "Brezilya", "İzlanda", "Mısır", "Kanada", "İtalya", "Fas", "Avustralya", "Arjantin", "Norveç", "Hindistan", "Meksika", "Güney Kore", "Kenya", "İsviçre", "Tayland", "Yeni Zelanda", "Portekiz", "Peru"],
  "Hayvanlar": ["Ahtapot", "Kapibara", "Penguen", "Kızıl panda", "Kutup ayısı", "Bukalemun", "Flamingo", "Kanguru", "Su samuru", "Tavus kuşu", "Kirpi", "Tembel hayvan", "Denizatı", "Vaşak", "Yunus", "Koala", "Pelikan", "Tarantula", "Fil", "Kurt", "Alpaka", "Timsah", "Sincap", "Baykuş"],
  "Futbol takımları": ["Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Real Madrid", "Barcelona", "Liverpool", "Manchester City", "Arsenal", "Bayern Münih", "PSG", "Inter", "Milan", "Juventus", "Ajax", "Borussia Dortmund", "Atletico Madrid", "Benfica", "Porto", "Celtic", "Napoli", "Roma", "Tottenham", "Chelsea"],
  "Futbolcular": ["Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappé", "Erling Haaland", "Luka Modrić", "Neymar", "Mohamed Salah", "Kevin De Bruyne", "Vinícius Júnior", "Jude Bellingham", "Arda Güler", "Hakan Çalhanoğlu", "İlkay Gündoğan", "Harry Kane", "Zlatan Ibrahimović", "Ronaldinho", "Zinedine Zidane", "Didier Drogba", "Sergio Ramos", "Sadio Mané", "Son Heung-min", "Robert Lewandowski", "Andrea Pirlo", "David Beckham"]
};

function secureIndex(max) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

export class Room {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
    this.clients = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json();
      if (!body.password || String(body.password).length > 32) return json({ error: "Şifre 1–32 karakter olmalı." }, 400);
      await this.storage.put("room", { password: String(body.password), members: [], game: null, createdAt: Date.now() });
      return json({ ok: true });
    }
    if (request.headers.get("upgrade") !== "websocket") return json({ error: "WebSocket bağlantısı gerekli." }, 426);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener("message", (event) => this.onMessage(server, event.data));
    server.addEventListener("close", () => this.onClose(server));
    server.addEventListener("error", () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async onMessage(socket, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = await this.storage.get("room");
    if (!room) return socket.send(JSON.stringify({ type: "error", message: "Oda bulunamadı." }));
    if (msg.type === "join") {
      if (String(msg.password) !== room.password) return socket.send(JSON.stringify({ type: "error", message: "Oda şifresi yanlış." }));
      const nickname = String(msg.nickname || "Oyuncu").trim().slice(0, 18) || "Oyuncu";
      let member = room.members.find((m) => m.id === msg.playerId);
      if (!member) {
        if (room.members.length >= 8) return socket.send(JSON.stringify({ type: "error", message: "Oda dolu (en fazla 8 kişi)." }));
        member = { id: crypto.randomUUID(), nickname, joinedAt: Date.now() };
        room.members.push(member);
      } else member.nickname = nickname;
      this.clients.set(socket, member.id);
      await this.storage.put("room", room);
      socket.send(JSON.stringify({ type: "joined", playerId: member.id, room: this.publicRoom(room) }));
      this.broadcast({ type: "room", room: this.publicRoom(room) });
      if (room.game?.kind === "spyfall" && room.game.roles?.[member.id]) socket.send(JSON.stringify({ type: "role", role: room.game.roles[member.id] }));
      if (room.game?.kind === "codenames" && room.game.masterId === member.id) socket.send(JSON.stringify({ type: "game", game: this.publicGame(room.game, room.members), master: room.game.keys }));
      return;
    }
    const playerId = this.clients.get(socket);
    if (!playerId || !room.members.some((m) => m.id === playerId)) return;
    if (msg.type === "start-spyfall") {
      if (room.members.length < 3) return this.sendError(socket, "Spyfall için en az 3 oyuncu gerekli.");
      const category = SPY_LOCATIONS[msg.category] ? msg.category : "Dünyadan yerler";
      const list = SPY_LOCATIONS[category];
      const location = list[secureIndex(list.length)];
      const spy = room.members[secureIndex(room.members.length)];
      const roles = Object.fromEntries(room.members.map((m) => [m.id, m.id === spy.id ? { spy: true, category } : { spy: false, category, location }]));
      room.game = { kind: "spyfall", category, round: (room.game?.round || 0) + 1, roles, startedAt: Date.now(), duration: 8 * 60 };
      await this.storage.put("room", room);
      this.broadcast({ type: "game", game: this.publicGame(room.game, room.members) });
      for (const [client, id] of this.clients) if (client.readyState === 1) client.send(JSON.stringify({ type: "role", role: roles[id] }));
      return;
    }
    if (msg.type === "stop-game") {
      room.game = null;
      await this.storage.put("room", room);
      this.broadcast({ type: "game", game: null });
      return;
    }
    if (msg.type === "start-city") {
      const letters = [..."ABCDEFGHİJKLMNÖPRSTUVYZ"];
      room.game = { kind: "city", letter: letters[secureIndex(letters.length)], categories: ["İsim", "Şehir", "Ülke", "Hayvan", "Bitki", "Yemek", "Eşya", "Ünlü"], startedAt: Date.now(), duration: 90, submissions: {} };
      await this.storage.put("room", room);
      this.sendGame(room);
      return;
    }
    if (msg.type === "submit-city" && room.game?.kind === "city") {
      const allowed = new Set(room.game.categories);
      const answers = {};
      for (const [key, value] of Object.entries(msg.answers || {})) if (allowed.has(key)) answers[key] = String(value).trim().slice(0, 48);
      room.game.submissions[playerId] = answers;
      await this.storage.put("room", room);
      this.sendGame(room);
      return;
    }
    if (msg.type === "start-xox") {
      const top = Array.isArray(msg.top) ? msg.top.slice(0, 3).map(String) : [];
      const side = Array.isArray(msg.side) ? msg.side.slice(0, 3).map(String) : [];
      if (top.length !== 3 || side.length !== 3 || [...top, ...side].some((team) => team.length > 40)) return this.sendError(socket, "Tahta takımları geçersiz.");
      room.game = { kind: "xox", top, side, picks: {}, round: (room.game?.round || 0) + 1 };
      await this.storage.put("room", room);
      this.sendGame(room);
      return;
    }
    if (msg.type === "pick-xox" && room.game?.kind === "xox") {
      const key = String(msg.key || ""), name = String(msg.name || "").trim().slice(0, 48);
      if (!/^\d-\d$/.test(key) || !name) return;
      room.game.picks[key] = name;
      await this.storage.put("room", room);
      this.sendGame(room);
      return;
    }
    if (msg.type === "start-codenames") {
      if (room.members.length < 2) return this.sendError(socket, "Codenames için en az 2 oyuncu gerekli.");
      const words = ["elma","köprü","ay","keman","limon","kule","bulut","çekiç","tilki","banka","deniz","yıldız","çay","orman","kral","uçak","kalem","şeker","göz","taç","rüya","buz","kedi","anahtar","bahar","fener","korsan","saat","göl","roket","müzik","balık","ateş","kitap","yol","güneş","maske","altın","dağ","pasta","gemi","gül","kâğıt","ejderha","pencere","zeytin","radyo","kaktüs","tren","ayna","kurt","kamera","taş","ipek","kupa","kavun","robot","kapı","kartal","mor","liman","fırça","dünya","çorap","kum","şapka","karınca","sırt","kutu","sahil","perde","çan","çorba","piyano","gölge","kar","yüzük","pazar","bal","duman","çöl","mektup","rozet","aslan","leylek","kuyu","şeftali","mantar","fırtına","uçurtma","koltuk","sinek","tünel","biber","düğme","yastık","bilet","orman","şato","gitar"];
      for (let i = words.length - 1; i > 0; i--) { const j = secureIndex(i + 1); [words[i], words[j]] = [words[j], words[i]]; }
      const redStarts = secureIndex(2) === 0;
      const keys = Array.from({ length: 25 }, (_, i) => i < 9 ? (redStarts ? "red" : "blue") : i < 17 ? (redStarts ? "blue" : "red") : i === 24 ? "assassin" : "neutral");
      for (let i = keys.length - 1; i > 0; i--) { const j = secureIndex(i + 1); [keys[i], keys[j]] = [keys[j], keys[i]]; }
      room.game = { kind: "codenames", words: words.slice(0, 25), keys, revealed: [], redStarts, turn: redStarts ? "red" : "blue", scores: { red: 0, blue: 0 }, round: (room.game?.round || 0) + 1, masterId: playerId };
      await this.storage.put("room", room);
      this.sendGame(room);
      return;
    }
    if (msg.type === "pick-word" && room.game?.kind === "codenames") {
      const i = Number(msg.index);
      if (!Number.isInteger(i) || i < 0 || i >= 25 || room.game.revealed.includes(i)) return;
      room.game.revealed.push(i);
      const key = room.game.keys[i];
      if (key === room.game.turn) room.game.scores[key]++;
      else if (key === "assassin") room.game.winner = room.game.turn === "red" ? "blue" : "red";
      else if (key === "red" || key === "blue") { room.game.scores[key]++; room.game.turn = key; }
      else room.game.turn = room.game.turn === "red" ? "blue" : "red";
      if (!room.game.winner && room.game.scores.red >= 9) room.game.winner = "red";
      if (!room.game.winner && room.game.scores.blue >= 8) room.game.winner = "blue";
      await this.storage.put("room", room);
      this.sendGame(room);
    }
  }

  async onClose(socket) {
    const id = this.clients.get(socket);
    if (!id) return;
    this.clients.delete(socket);
    if ([...this.clients].some(([client, playerId]) => playerId === id && client.readyState === 1)) return;
    const room = await this.storage.get("room");
    if (!room) return;
    room.members = room.members.filter((m) => m.id !== id);
    if (room.game?.kind === "spyfall") delete room.game.roles?.[id];
    await this.storage.put("room", room);
    this.broadcast({ type: "room", room: this.publicRoom(room) });
  }

  publicRoom(room) { return { players: room.members.map(({ id, nickname }) => ({ id, nickname })), game: this.publicGame(room.game, room.members) }; }
  publicGame(game, members = []) {
    if (!game) return null;
    if (game.kind === "spyfall") return { kind: game.kind, category: game.category, round: game.round, startedAt: game.startedAt, duration: game.duration, players: members.map((m) => m.nickname) };
    if (game.kind === "city") return { kind: game.kind, letter: game.letter, categories: game.categories, startedAt: game.startedAt, duration: game.duration, submissions: Object.fromEntries(Object.entries(game.submissions || {}).map(([id, answers]) => [members.find((m) => m.id === id)?.nickname || "Oyuncu", answers])) };
    if (game.kind === "xox") return { kind: game.kind, top: game.top, side: game.side, picks: game.picks, round: game.round };
    return { kind: game.kind, words: game.words, revealed: game.revealed, turn: game.turn, scores: game.scores, winner: game.winner, round: game.round };
  }
  broadcast(msg) { for (const socket of this.clients.keys()) if (socket.readyState === 1) socket.send(JSON.stringify(msg)); }
  sendGame(room) {
    for (const [socket, id] of this.clients) if (socket.readyState === 1) {
      const payload = { type: "game", game: this.publicGame(room.game, room.members) };
      if (room.game?.kind === "codenames" && id === room.game.masterId) payload.master = room.game.keys;
      socket.send(JSON.stringify(payload));
    }
  }
  sendError(socket, message) { socket.send(JSON.stringify({ type: "error", message })); }
}
