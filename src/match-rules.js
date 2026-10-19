import { createSpy, createCity, cityScores } from './game-rules.js';

const rosterNames = (members) => Object.fromEntries(members.map((member) => [member.id, member.nickname]));
export function createSpyMatch(members, category) {
  const game = createSpy(members, category);
  game.phase = 'playing'; game.participants = members.map((m) => m.id); game.names = rosterNames(members);
  game.match = { id: crypto.randomUUID(), target: 10, scores: Object.fromEntries(game.participants.map((id) => [id, 0])), finished: false, winners: [] };
  return game;
}
export const spyId = (game) => Object.keys(game.roles).find((id) => game.roles[id].spy);
export const spyLocation = (game) => Object.values(game.roles).find((role) => !role.spy)?.location;
export function settleSpy(game, reason, pointsForSpy) {
  if (game.phase === 'results') return false;
  const spy = spyId(game);
  const awards = Object.fromEntries(game.participants.map((id) => [id, pointsForSpy ? (id === spy ? pointsForSpy : 0) : (id !== spy ? 2 : 0)]));
  for (const [id, points] of Object.entries(awards)) game.match.scores[id] += points;
  game.phase = 'results'; game.result = { reason, spyId: spy, location: spyLocation(game), awards };
  game.match.winners = game.participants.filter((id) => game.match.scores[id] >= game.match.target);
  game.match.finished = game.match.winners.length > 0;
  delete game.vote; delete game.guess;
  return true;
}
export function beginSpyVote(game, now = Date.now()) {
  if (game.phase !== 'playing') throw new Error('Şu an oylama başlatılamaz.');
  game.phase = 'voting'; game.vote = { id: crypto.randomUUID(), ballots: {}, deadline: now + 30000 };
}
export function resolveSpyVote(game, now = Date.now()) {
  if (game.phase !== 'voting') return;
  const counts = {};
  for (const target of Object.values(game.vote.ballots)) counts[target] = (counts[target] || 0) + 1;
  const accused = Object.keys(counts).find((id) => counts[id] > game.participants.length / 2);
  if (accused) {
    if (accused !== spyId(game)) { settleSpy(game, 'wrong-vote', 2); return; }
    game.phase = 'guessing'; game.guess = { mode: 'caught', deadline: now + 30000 };
    delete game.vote;
  } else if (Object.keys(game.vote.ballots).length === game.participants.length || now >= game.vote.deadline) {
    delete game.vote;
    if (now >= game.startedAt + game.duration * 1000) settleSpy(game, 'escaped', 2);
    else game.phase = 'playing';
  }
}
export function beginSpyGuess(game, playerId, now = Date.now()) {
  if (playerId !== spyId(game) || game.phase !== 'playing') throw new Error('Şu an tahmin başlatamazsın.');
  game.phase = 'guessing'; game.guess = { mode: 'voluntary', deadline: now + 30000 };
}
export function submitSpyGuess(game, playerId, location) {
  if (game.phase !== 'guessing' || playerId !== spyId(game)) throw new Error('Bu tahmin hakkı casusa ait.');
  if (!game.candidates.includes(location)) throw new Error('Listeden bir cevap seç.');
  const correct = location === spyLocation(game);
  const mode = game.guess.mode;
  settleSpy(game, correct ? (mode === 'caught' ? 'caught-correct' : 'guess-correct') : 'guess-wrong', correct ? (mode === 'caught' ? 1 : 2) : 0);
}
export function nextSpyRound(game, members) {
  if (game.phase !== 'results' || game.match.finished) throw new Error('Yeni tur başlatılamaz.');
  const participants = game.participants.map((id) => members.find((m) => m.id === id));
  if (participants.some((m) => !m)) throw new Error('Sonraki tur için maçtaki bütün oyuncular bağlı olmalı.');
  const next = createSpy(participants, game.category, game.round + 1);
  return { ...next, phase: 'playing', participants: game.participants, names: rosterNames(participants), match: structuredClone(game.match) };
}
export function expireSpy(game, now = Date.now()) {
  if (game.phase === 'playing' && now >= game.startedAt + game.duration * 1000) { beginSpyVote(game, now); return true; }
  if (game.phase === 'voting' && now >= game.vote.deadline) { resolveSpyVote(game, now); return true; }
  if (game.phase === 'guessing' && now >= game.guess.deadline) { settleSpy(game, 'guess-timeout', 0); return true; }
  return false;
}
export function publicSpy(game) {
  const { kind, gameId, category, candidates, round, startedAt, duration, phase, participants, names, match, result } = game;
  const vote = game.vote ? { id: game.vote.id, deadline: game.vote.deadline, votedIds: Object.keys(game.vote.ballots), counts: Object.fromEntries(participants.map((id) => [id, Object.values(game.vote.ballots).filter((target) => target === id).length])) } : undefined;
  return { kind, gameId, category, candidates, round, startedAt, duration, phase, participants, names, match, result, vote, ...(game.guess ? { guess: { ...game.guess, spyId: spyId(game) } } : {}) };
}

export function createCityMatch(members) {
  const participants = members.map((m) => m.id);
  return { ...createCity(), participants, names: rosterNames(members), match: { id: crypto.randomUUID(), round: 1, totalRounds: 5, baseTotals: Object.fromEntries(participants.map((id) => [id, 0])), usedLetters: [], history: [] } };
}
export function cityMatchView(game) {
  const totals = { ...game.match.baseTotals };
  if (game.phase === 'results') for (const [id, score] of Object.entries(cityScores(game))) totals[id] = (totals[id] || 0) + score.total;
  const finished = game.phase === 'results' && game.match.round === game.match.totalRounds;
  const high = Math.max(...Object.values(totals));
  return { id: game.match.id, round: game.match.round, totalRounds: game.match.totalRounds, totals, finished, winners: finished ? Object.keys(totals).filter((id) => totals[id] === high) : [] };
}
export function nextCityRound(game) {
  const view = cityMatchView(game);
  if (game.phase !== 'results' || view.finished) throw new Error('Bu maçta yeni tur başlatılamaz.');
  const next = createCity({ excludeLetters: [...game.match.usedLetters, game.letter] });
  return { ...next, participants: game.participants, names: game.names, match: { ...structuredClone(game.match), round: game.match.round + 1, baseTotals: view.totals, usedLetters: [...game.match.usedLetters, game.letter], history: [...game.match.history, { round: game.match.round, letter: game.letter, scores: cityScores(game) }] } };
}

export function createXoxSeries() {
  return { id: crypto.randomUUID(), scores: { X: 0, O: 0 }, winsTo: 2, finished: false, winner: null, history: [] };
}
export function recordXoxResult(game) {
  if (!game.winner || game.series.history.some((round) => round.boardId === game.boardId)) return;
  game.series.history.push({ boardId: game.boardId, winner: game.winner });
  if (game.winner !== 'draw') game.series.scores[game.winner]++;
  if (game.series.scores.X >= game.series.winsTo) game.series.winner = 'X';
  if (game.series.scores.O >= game.series.winsTo) game.series.winner = 'O';
  game.series.finished = Boolean(game.series.winner);
}
