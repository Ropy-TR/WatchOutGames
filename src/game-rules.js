import { CODE_WORDS, CITY_CATEGORIES, CITY_LETTERS, SPY_CATEGORIES } from './game-data.js';

export function secureIndex(max, fill = (bytes) => crypto.getRandomValues(bytes)) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new Error('Geçersiz zar aralığı.');
  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  do fill(bytes); while (bytes[0] >= limit);
  return bytes[0] % max;
}
export function shuffled(items, random = secureIndex) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createSpy(members, category, round = 1, random = secureIndex) {
  if (members.length < 3) throw new Error('Spyfall için en az 3 oyuncu gerekli.');
  if (typeof category !== 'string' || !Object.hasOwn(SPY_CATEGORIES, category)) category = 'Mekânlar';
  const candidates = SPY_CATEGORIES[category];
  const location = candidates[random(candidates.length)];
  // Every round is independent. Previous spies never affect this draw.
  const spy = members[random(members.length)].id;
  return { kind: 'spyfall', gameId: crypto.randomUUID(), round, category, candidates,
    startedAt: Date.now(), duration: 600,
    roles: Object.fromEntries(members.map(({ id }) => [id, id === spy ? { spy: true, category } : { spy: false, category, location }])) };
}
export function createCity({ excludeLetters = [] } = {}) {
  const letters = CITY_LETTERS.filter((letter) => !excludeLetters.includes(letter));
  return { kind: 'city', gameId: crypto.randomUUID(), letter: letters[secureIndex(letters.length)],
    categories: CITY_CATEGORIES, startedAt: Date.now(), duration: 90, phase: 'playing', drafts: {}, submissions: {}, invalid: {} };
}
export const normalizedAnswer = (value) => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');
export function cleanAnswers(answers, categories = CITY_CATEGORIES) {
  return Object.fromEntries(categories.map((category) => [category, String(answers?.[category] || '').normalize('NFC').trim().slice(0, 48)]));
}
export function cityScores(game) {
  const scores = {};
  const valid = (id, category, answer) => normalizedAnswer(answer).startsWith(game.letter) && !game.invalid?.[id]?.[category];
  for (const [id, answers] of Object.entries(game.submissions)) {
    const cells = {};
    for (const category of game.categories) {
      const answer = normalizedAnswer(answers[category]);
      const matches = Object.entries(game.submissions).filter(([otherId, other]) => valid(otherId, category, other[category]) && normalizedAnswer(other[category]) === answer).length;
      cells[category] = valid(id, category, answer) ? (matches > 1 ? 5 : 10) : 0;
    }
    scores[id] = { cells, total: Object.values(cells).reduce((a, b) => a + b, 0) };
  }
  return scores;
}
export function finishCity(game) {
  if (game.phase !== 'playing') return;
  for (const id of game.participants) if (!game.submissions[id]) game.submissions[id] = cleanAnswers(game.drafts[id]);
  game.phase = 'results';
  delete game.drafts;
}
export function createCodeLobby() {
  return { kind: 'codenames', gameId: crypto.randomUUID(), phase: 'lobby', assignments: {}, words: [], revealed: [], keys: [], scores: { red: 0, blue: 0 } };
}
export function beginCode(game, members, random = secureIndex) {
  for (const team of ['red', 'blue']) {
    const participants = members.filter((m) => game.assignments[m.id]?.team === team);
    if (participants.filter((m) => game.assignments[m.id].role === 'master').length !== 1 || !participants.some((m) => game.assignments[m.id].role === 'guesser')) throw new Error('Her takımda bir anlatıcı ve en az bir tahminci olmalı.');
  }
  const starting = random(2) === 0 ? 'red' : 'blue';
  game.words = shuffled(CODE_WORDS, random).slice(0, 25);
  game.keys = shuffled([...Array(9).fill(starting), ...Array(8).fill(opponent(starting)), ...Array(7).fill('neutral'), 'assassin'], random);
  game.phase = 'playing'; game.turn = starting; game.targets = { [starting]: 9, [opponent(starting)]: 8 };
  game.clue = null; game.guessesLeft = 0; game.guessesMade = 0; game.turnId = crypto.randomUUID();
}
export const opponent = (team) => team === 'red' ? 'blue' : 'red';
export function endCodeTurn(game) {
  game.turn = opponent(game.turn); game.clue = null; game.guessesLeft = 0; game.guessesMade = 0; game.turnId = crypto.randomUUID();
}
export function pickCode(game, id, index, turnId) {
  const assignment = game.assignments[id];
  if (game.phase !== 'playing' || game.winner) throw new Error('Oyun devam etmiyor.');
  if (turnId !== game.turnId) throw new Error('Sıra değişti.');
  if (assignment?.role !== 'guesser' || assignment.team !== game.turn) throw new Error('Tahmin sırası senin takımında değil.');
  if (!game.clue || game.guessesLeft < 1) throw new Error('Önce anlatıcı ipucu vermeli.');
  if (!Number.isInteger(index) || index < 0 || index >= 25 || game.revealed.includes(index)) throw new Error('Bu kart seçilemez.');
  const key = game.keys[index];
  game.revealed.push(index); game.guessesLeft--; game.guessesMade++;
  if (key === 'assassin') game.winner = opponent(game.turn);
  else if (key === 'red' || key === 'blue') {
    game.scores[key]++;
    if (game.scores[key] >= game.targets[key]) game.winner = key;
  }
  if (game.winner) game.phase = 'finished';
  else if (key !== game.turn || game.guessesLeft === 0) endCodeTurn(game);
}
export const WIN_LINES = [ ['0-0','0-1','0-2'], ['1-0','1-1','1-2'], ['2-0','2-1','2-2'], ['0-0','1-0','2-0'], ['0-1','1-1','2-1'], ['0-2','1-2','2-2'], ['0-0','1-1','2-2'], ['0-2','1-1','2-0'] ];
export function xoxOutcome(owners) {
  for (const line of WIN_LINES) if (owners[line[0]] && line.every((cell) => owners[cell] === owners[line[0]])) return { winner: owners[line[0]], winningLine: line };
  return Object.keys(owners).length === 9 ? { winner: 'draw', winningLine: [] } : null;
}
export function advanceXox(game, now = Date.now()) {
  game.turn = game.turn === 'X' ? 'O' : 'X'; game.turnId = crypto.randomUUID(); game.deadline = now + 30000;
}
export function expireXox(game, now = Date.now()) {
  if (game.winner || now < game.deadline) return false;
  const steps = Math.floor((now - game.deadline) / 30000) + 1;
  if (steps % 2) game.turn = game.turn === 'X' ? 'O' : 'X';
  game.deadline += steps * 30000; game.turnId = crypto.randomUUID();
  return true;
}
