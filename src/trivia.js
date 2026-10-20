import { duelSeats, requireDuelPlayers } from './duel-lobby.js';
import { triviaDeck } from './trivia-data.js';
import { FLAG_COUNTRIES } from './flag-data.js';
const countryCodes = new Set(FLAG_COUNTRIES.map(country => country.code));
export function createTrivia(members, initiator, category) {
  if (!['football','lol','flags'].includes(category)) throw new Error('Geçersiz kategori.');
  const flags = category === 'flags';
  return { kind: flags ? 'flags' : 'quiz', category, ...(flags ? {inputMode:'country-search'} : {}), gameId: crypto.randomUUID(), phase: 'lobby', ...duelSeats(members, initiator), participants: [], round: 0, total: flags ? 15 : 10, duration: flags ? 30000 : 20000, deck: [], responses: {}, scores: {}, mistakes: {}, history: [], deadline: null, roundId: null };
}
export function beginTrivia(game, id, connected, members, now = Date.now()) {
  if (game.kind === 'flags') {
    if (game.phase !== 'lobby' || members.length < 2 || members.length > 8) throw new Error('Bayrak Yarışı için 2–8 bağlı oyuncu gerekli.');
    game.participants = members.map(member => member.id);
    game.names = Object.fromEntries(members.map(member => [member.id, member.nickname]));
  } else { requireDuelPlayers(game, id, connected); game.participants = [...game.players]; }
  game.deck = triviaDeck(game.category, game.total);
  for (const player of game.participants) { game.scores[player] = 0; game.mistakes[player] = 0; }
  game.round = 1; newRound(game, now);
}
function newRound(game, now) { game.phase = 'playing'; game.responses = {}; game.roundId = crypto.randomUUID(); game.deadline = now + game.duration; }
function finishRound(game, now) {
  const question = game.deck[game.round - 1];
  for (const id of game.participants) {
    if (game.responses[id] === question.answer) game.scores[id]++;
    else game.mistakes[id]++;
  }
  game.history.push({ round: game.round, correct: game.kind === 'flags' ? question.answerLabel : question.options.find(option => option.id === question.answer).label, responses: { ...game.responses } });
  game.phase = 'review'; game.deadline = now + 5000;
}
export function answerTrivia(game, id, msg, now = Date.now()) {
  if (game.phase !== 'playing' || !game.participants.includes(id) || msg.roundId !== game.roundId || now >= game.deadline) throw new Error('Soru değişti veya bu maça katılmıyorsun.');
  const question = game.deck[game.round - 1];
  const selection = game.kind === 'flags' ? msg.country : msg.option;
  const valid = game.kind === 'flags' ? countryCodes.has(selection) : question.options.some(option => option.id === selection);
  if (Object.hasOwn(game.responses, id) || !valid) throw new Error('Cevap kilitlendi veya seçim geçersiz.');
  game.responses[id] = selection;
  if (game.participants.every(id => Object.hasOwn(game.responses, id))) finishRound(game, now);
}
export function expireTrivia(game, now = Date.now()) {
  if (!['playing','review'].includes(game.phase) || now < game.deadline) return false;
  if (game.phase === 'playing') finishRound(game, now);
  else if (game.round >= game.total) {
    game.phase = 'results'; game.deadline = null;
    const values = Object.values(game.mistakes), best = Math.min(...values), worst = Math.max(...values);
    game.winners = game.participants.filter(id => game.mistakes[id] === best);
    game.losers = game.participants.filter(id => game.mistakes[id] === worst);
    game.draw = best === worst;
  } else { game.round++; newRound(game, now); }
  return true;
}
export function triviaView(game) {
  const question = game.deck[game.round - 1];
  const showAnswer = ['review','results'].includes(game.phase);
  return { kind: game.kind, category: game.category, gameId: game.gameId, phase: game.phase, players: game.players, names: game.names, participants: game.participants, round: game.round, total: game.total, roundId: game.roundId, deadline: game.deadline, serverTime: Date.now(), scores: game.scores, mistakes: game.mistakes, answeredIds: Object.keys(game.responses), winners: game.winners, losers: game.losers, draw: game.draw,
    ...(game.kind === 'flags' ? { inputMode: game.inputMode } : {}),
    ...(question ? { question: { prompt: question.prompt, ...(game.kind === 'flags' ? {} : {options:question.options}), hasFlag: Boolean(question.flagCode) } } : {}),
    ...(showAnswer ? { answer: question.answer, ...(game.kind === 'flags' ? {answerLabel:question.answerLabel} : {}), responses: game.responses } : {}) };
}
export function triviaMine(game, id) { return game.participants.includes(id) ? (game.responses[id] || null) : null; }
