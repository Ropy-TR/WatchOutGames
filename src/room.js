import { createFootballBoard, footballCatalog, validateFootballPick, hasAvailableFootballMove } from './football.js';
import { cleanAnswers, finishCity, cityScores, createCodeLobby, beginCode, pickCode, endCodeTurn, secureIndex, advanceXox, expireXox, xoxOutcome } from './game-rules.js';
import { createSpyMatch, beginSpyVote, resolveSpyVote, beginSpyGuess, submitSpyGuess, nextSpyRound, expireSpy, publicSpy, createCityMatch, cityMatchView, nextCityRound, createXoxSeries, recordXoxResult } from './match-rules.js';

const dataVersion = footballCatalog().version;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
export class Room {
  constructor(state) { this.state = state; this.storage = state.storage; this.clients = new Map(); this.queue = Promise.resolve(); }
  // WebSocket handlers can interleave while awaiting storage. Serialize all mutations.
  enqueue(task) { const result = this.queue.then(task); this.queue = result.catch(() => {}); return result; }
  async loadRoom() {
    const room = await this.storage.get('room');
    if (!room) return room;
    // Rooms created before turn/role validation was introduced need a fresh game.
    const game = room.game;
    if (game && (game.kind === 'xox' ? !game.turnId || !game.teams || !game.series : !game.gameId || (['spyfall', 'city'].includes(game.kind) && !game.match))) {
      room.game = null;
      await this.storage.put('room', room);
      await this.schedule(null);
    }
    return room;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      const body = await request.json();
      if (!body.password || String(body.password).length > 32) return json({ error: 'Şifre 1–32 karakter olmalı.' }, 400);
      return this.enqueue(async () => {
        if (await this.storage.get('room')) return json({ error: 'Oda kodu kullanılıyor. Tekrar dene.' }, 409);
        await this.storage.put('room', { password: String(body.password), members: [], game: null, createdAt: Date.now() });
        return json({ ok: true });
      });
    }
    if (request.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket bağlantısı gerekli.' }, 426);
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    server.addEventListener('message', (event) => this.onMessage(server, event.data).catch(() => this.sendError(server, 'İşlem tamamlanamadı. Tekrar dene.')));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));
    return new Response(null, { status: 101, webSocket: client });
  }
  onMessage(socket, raw) { return this.enqueue(() => this.handleMessage(socket, raw)); }
  async handleMessage(socket, raw) {
    if (typeof raw !== 'string' || raw.length > 12000) return;
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
    const room = await this.loadRoom();
    if (!room) return this.sendError(socket, 'Oda bulunamadı.');
    await this.expire(room);
    if (msg.type === 'join') {
      if (String(msg.password) !== room.password) return this.sendError(socket, 'Oda şifresi yanlış.');
      if (this.clients.has(socket)) return;
      const nickname = String(msg.nickname || 'Oyuncu').trim().slice(0, 18) || 'Oyuncu';
      let member = room.members.find((m) => m.id === msg.playerId && m.token && m.token === msg.sessionToken);
      if (!member) {
        room.members = room.members.filter((m) => m.token && (m.online !== false || Date.now() - m.disconnectedAt < 15 * 60000));
        if (room.members.length >= 8) return this.sendError(socket, 'Oda dolu (en fazla 8 kişi).');
        member = { id: crypto.randomUUID(), token: crypto.randomUUID(), nickname, joinedAt: Date.now() };
        room.members.push(member);
      } else member.nickname = nickname;
      member.online = true; delete member.disconnectedAt;
      this.clients.set(socket, member.id);
      await this.storage.put('room', room);
      await this.schedule(room.game);
      socket.send(JSON.stringify({ type: 'joined', playerId: member.id, sessionToken: member.token, room: this.publicRoom(room) }));
      this.broadcast({ type: 'room', room: this.publicRoom(room) });
      this.sendGame(room);
      return;
    }
    const playerId = this.clients.get(socket);
    if (!playerId || !room.members.some((m) => m.id === playerId)) return;
    const game = room.game;
    const connected = new Set([...this.clients].filter(([client]) => client.readyState === 1).map(([, id]) => id));
    const active = room.members.filter((m) => connected.has(m.id));
    try {
      if (msg.type === 'leave') {
        room.members = room.members.filter((m) => m.id !== playerId);
        for (const [client, id] of this.clients) if (id === playerId) this.clients.delete(client);
        if (game?.phase === 'lobby') delete game.assignments[playerId];
        await this.save(room); this.broadcast({ type: 'room', room: this.publicRoom(room) }); return;
      }
      if (msg.type === 'stop-game') room.game = null;
      else if (msg.type === 'start-spyfall') {
        if (game?.kind === 'spyfall' && (!game.match.finished || !msg.restart || msg.gameId !== game.gameId)) throw new Error('Devam eden maç için sonraki turu kullan.');
        room.game = createSpyMatch(active, msg.category);
      }
      else if (['next-spy', 'start-spy-vote', 'vote-spy', 'start-spy-guess', 'guess-spy'].includes(msg.type) && game?.kind === 'spyfall') {
        if (msg.gameId !== game.gameId || !game.participants.includes(playerId)) throw new Error('Bu tura katılmıyorsun veya tur değişti.');
        if (msg.type === 'next-spy') room.game = nextSpyRound(game, active);
        if (msg.type === 'start-spy-vote') beginSpyVote(game);
        if (msg.type === 'start-spy-guess') beginSpyGuess(game, playerId);
        if (msg.type === 'guess-spy') submitSpyGuess(game, playerId, msg.location);
        if (msg.type === 'vote-spy') {
          if (game.phase !== 'voting' || msg.voteId !== game.vote.id || !game.participants.includes(msg.targetId) || game.vote.ballots[playerId]) throw new Error('Oy kullanılamaz.');
          game.vote.ballots[playerId] = msg.targetId;
          resolveSpyVote(game);
        }
      }
      else if (msg.type === 'start-city') {
        if (game?.kind === 'city' && (!cityMatchView(game).finished || !msg.restart || msg.gameId !== game.gameId)) throw new Error('Devam eden maç için sonraki turu kullan.');
        room.game = createCityMatch(active);
      }
      else if (msg.type === 'next-city' && game?.kind === 'city') {
        if (msg.gameId !== game.gameId || !game.participants.includes(playerId)) throw new Error('Bu maçta yeni tur başlatamazsın.');
        room.game = nextCityRound(game);
      }
      else if ((msg.type === 'save-city' || msg.type === 'submit-city') && game?.kind === 'city') {
        if (msg.gameId !== game.gameId || game.phase !== 'playing' || !game.participants.includes(playerId)) throw new Error('Bu turda cevap gönderilemez.');
        if (game.submissions[playerId]) throw new Error('Cevaplarını zaten gönderdin.');
        const answers = cleanAnswers(msg.answers, game.categories);
        game.drafts[playerId] = answers;
        if (msg.type === 'submit-city') game.submissions[playerId] = answers;
        if (game.participants.every((id) => game.submissions[id])) finishCity(game);
        if (msg.type === 'save-city') { await this.storage.put('room', room); return; }
      }
      else if (msg.type === 'review-city' && game?.kind === 'city') {
        if (msg.gameId !== game.gameId || game.phase !== 'results' || !game.participants.includes(playerId) || !game.participants.includes(msg.targetId) || !game.categories.includes(msg.category)) throw new Error('Geçersiz değerlendirme.');
        (game.invalid[msg.targetId] ||= {})[msg.category] = Boolean(msg.invalid);
      }
      else if (msg.type === 'start-codenames') room.game = createCodeLobby();
      else if (msg.type === 'join-code-team' && game?.kind === 'codenames') {
        if (msg.gameId !== game.gameId || game.phase !== 'lobby' || !['red', 'blue'].includes(msg.team) || !['master', 'guesser'].includes(msg.role)) throw new Error('Takım seçilemedi.');
        if (msg.role === 'master' && Object.entries(game.assignments).some(([id, role]) => id !== playerId && role.team === msg.team && role.role === 'master')) throw new Error('Bu takımın anlatıcısı zaten var.');
        game.assignments[playerId] = { team: msg.team, role: msg.role };
      }
      else if (msg.type === 'begin-code' && game?.kind === 'codenames') {
        if (msg.gameId !== game.gameId || game.phase !== 'lobby') throw new Error('Oyun zaten başladı.');
        beginCode(game, active); game.names = Object.fromEntries(active.map((m) => [m.id, m.nickname]));
      }
      else if (msg.type === 'code-clue' && game?.kind === 'codenames') {
        if (game.phase !== 'playing' || msg.turnId !== game.turnId || game.assignments[playerId]?.role !== 'master' || game.assignments[playerId]?.team !== game.turn || game.clue) throw new Error('Şu an ipucu veremezsin.');
        const word = String(msg.word || '').normalize('NFC').trim().slice(0, 40);
        const count = Number(msg.count);
        if (!/^[\p{L}]+(?:[-’'][\p{L}]+)*$/u.test(word) || !Number.isInteger(count) || count < 0 || count > 9 || game.words.some((w, i) => !game.revealed.includes(i) && w.toLocaleLowerCase('tr-TR') === word.toLocaleLowerCase('tr-TR'))) throw new Error('Tahtada olmayan tek kelime ve 0–9 arasında sayı gir.');
        game.clue = { word, count }; game.guessesLeft = count === 0 ? 25 : count + 1;
      }
      else if (msg.type === 'pick-word' && game?.kind === 'codenames') pickCode(game, playerId, msg.index, msg.turnId);
      else if (msg.type === 'pass-code' && game?.kind === 'codenames') {
        if (game.phase !== 'playing' || msg.turnId !== game.turnId || !game.clue || !game.guessesMade || game.assignments[playerId]?.role !== 'guesser' || game.assignments[playerId]?.team !== game.turn) throw new Error('En az bir tahminden sonra sıra geçilebilir.');
        endCodeTurn(game);
      }
      else if (msg.type === 'start-xox') {
        if (active.length < 2) throw new Error('Futbol XOX için en az 2 oyuncu gerekli.');
        const existing = game?.kind === 'xox';
        const reconfigure = existing && !game.series.finished && !game.series.history.length && !Object.keys(game.picks).length && !game.winner;
        if (existing && (!reconfigure && (!game.series.finished || !msg.restart || msg.boardId !== game.boardId))) throw new Error('Devam eden seri için sonraki tahtayı kullan.');
        if (reconfigure && !Object.values(game.teams).flat().includes(playerId)) throw new Error('Bu seride oyuncu değilsin.');
        const board = createFootballBoard(msg, secureIndex);
        room.game = { ...board, owners: {}, series: reconfigure ? game.series : createXoxSeries(), teams: reconfigure ? game.teams : { X: active.filter((_, i) => i % 2 === 0).map((m) => m.id), O: active.filter((_, i) => i % 2 === 1).map((m) => m.id) }, names: reconfigure ? game.names : Object.fromEntries(active.map((m) => [m.id, m.nickname])), turn: secureIndex(2) ? 'X' : 'O', turnId: crypto.randomUUID(), deadline: Date.now() + 30000, round: 1 };
      }
      else if (msg.type === 'next-xox' && game?.kind === 'xox') {
        if (msg.boardId !== game.boardId || !game.winner || game.series.finished || !Object.values(game.teams).flat().includes(playerId)) throw new Error('Sonraki tahta başlatılamaz.');
        if (Object.values(game.teams).some((team) => !team.some((id) => connected.has(id)))) throw new Error('Her iki takımdan en az bir oyuncu bağlı olmalı.');
        room.game = { ...createFootballBoard({ mode: game.mode }, secureIndex), owners: {}, series: structuredClone(game.series), teams: game.teams, names: game.names, turn: game.turn === 'X' ? 'O' : 'X', turnId: crypto.randomUUID(), deadline: Date.now() + 30000, round: game.round + 1 };
      }
      else if ((msg.type === 'pick-xox' || msg.type === 'pass-xox') && game?.kind === 'xox') {
        if (game.winner) throw new Error('Oyun bitti. Yeni tahta başlat.');
        if (msg.boardId !== game.boardId || msg.turnId !== game.turnId) throw new Error('Tahta veya sıra değişti.');
        if (!game.teams?.[game.turn]?.includes(playerId)) throw new Error('Sıra senin takımında değil.');
        if (msg.type === 'pick-xox') {
          if (!/^[0-2]-[0-2]$/.test(String(msg.key)) || game.picks[msg.key]) throw new Error('Bu hücre seçilemez.');
          try {
            const player = validateFootballPick(game, msg);
            game.picks[msg.key] = player.name; game.playerPicks[msg.key] = player.id; game.owners[msg.key] = game.turn;
            const outcome = xoxOutcome(game.owners);
            if (outcome) Object.assign(game, outcome);
            else if (!hasAvailableFootballMove(game)) Object.assign(game, { winner: 'draw', winningLine: [] });
          } catch (error) { this.sendError(socket, error.message + ' Sıra diğer takımda.'); }
        }
        if (game.winner) recordXoxResult(game);
        else advanceXox(game);
      }
      else return;
      await this.save(room);
    } catch (error) { this.sendError(socket, error.message); }
  }
  async save(room) {
    await this.storage.put('room', room);
    await this.schedule(room.game);
    this.sendGame(room);
  }
  async schedule(game) {
    const deadline = game?.kind === 'spyfall' ? (game.phase === 'playing' ? game.startedAt + game.duration * 1000 : game.phase === 'voting' ? game.vote.deadline : game.phase === 'guessing' ? game.guess.deadline : null) : game?.kind === 'city' && game.phase === 'playing' ? game.startedAt + game.duration * 1000 : game?.kind === 'xox' && !game.winner && this.clients.size > 0 ? game.deadline : null;
    if (deadline && this.storage.setAlarm) await this.storage.setAlarm(deadline);
    else if (this.storage.deleteAlarm) await this.storage.deleteAlarm();
  }
  async expire(room) {
    const game = room.game;
    if (!game) return;
    let changed = false;
    if (game.kind === 'spyfall') changed = expireSpy(game);
    if (game.kind === 'city' && game.phase === 'playing' && Date.now() >= game.startedAt + game.duration * 1000) { finishCity(game); changed = true; }
    if (game.kind === 'xox' && game.deadline) changed = expireXox(game) || changed;
    if (changed) await this.save(room);
  }
  alarm() { return this.enqueue(async () => { const room = await this.loadRoom(); if (room) { await this.expire(room); await this.schedule(room.game); } }); }
  onClose(socket) { return this.enqueue(async () => {
    const id = this.clients.get(socket); this.clients.delete(socket);
    if (!id || [...this.clients].some(([client, player]) => player === id && client.readyState === 1)) return;
    const room = await this.loadRoom(); if (!room) return;
    const member = room.members.find((m) => m.id === id);
    if (member) { member.online = false; member.disconnectedAt = Date.now(); }
    await this.storage.put('room', room); await this.schedule(room.game); this.broadcast({ type: 'room', room: this.publicRoom(room) });
  }); }
  publicRoom(room) { return { players: room.members.map(({ id, nickname, online }) => ({ id, nickname, online })), game: this.publicGame(room.game, room.members) }; }
  publicGame(game, members = []) {
    if (!game) return null;
    if (game.kind === 'spyfall') return publicSpy(game);
    if (game.kind === 'city') return { kind: game.kind, gameId: game.gameId, phase: game.phase, letter: game.letter, categories: game.categories, startedAt: game.startedAt, duration: game.duration, names: game.names, match: cityMatchView(game), submittedIds: Object.keys(game.submissions), ...(game.phase === 'results' ? { submissions: game.submissions, scores: cityScores(game), invalid: game.invalid } : {}) };
    if (game.kind === 'xox') return game.boardId && game.dataVersion === dataVersion ? { kind: game.kind, top: game.top, side: game.side, topIds: game.topIds, sideIds: game.sideIds, picks: game.picks, pickedPlayerIds: game.playerPicks, round: game.round, boardId: game.boardId, mode: game.mode, dataVersion: game.dataVersion, teams: game.teams, names: game.names, owners: game.owners, turn: game.turn, turnId: game.turnId, deadline: game.deadline, winner: game.winner, winningLine: game.winningLine, series: game.series } : null;
    if (game.kind === 'codenames') return { kind: game.kind, gameId: game.gameId, phase: game.phase, assignments: game.assignments, names: game.phase === 'lobby' ? Object.fromEntries(members.map((m) => [m.id, m.nickname])) : game.names, words: game.words, revealed: game.revealed, colors: Object.fromEntries(game.keys.flatMap((key, i) => game.winner || game.revealed.includes(i) ? [[i, key]] : [])), turn: game.turn, turnId: game.turnId, scores: game.scores, targets: game.targets, winner: game.winner, clue: game.clue, guessesLeft: game.guessesLeft, guessesMade: game.guessesMade };
    return null;
  }
  broadcast(msg) { for (const client of this.clients.keys()) if (client.readyState === 1) client.send(JSON.stringify(msg)); }
  sendGame(room) {
    for (const [client, id] of this.clients) if (client.readyState === 1) {
      const payload = { type: 'game', game: this.publicGame(room.game, room.members) };
      const game = room.game;
      if (game?.kind === 'codenames' && game.phase !== 'lobby' && game.assignments[id]?.role === 'master') payload.master = game.keys;
      if (game?.kind === 'city') payload.mine = game.submissions[id] || game.drafts?.[id] || {};
      if (game?.kind === 'spyfall') payload.role = game.roles[id] || null;
      client.send(JSON.stringify(payload));
    }
  }
  sendError(socket, message) { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'error', message })); }
}
