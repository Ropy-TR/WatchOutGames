import data from './football-dataset.js';
import { sampleFootballClubs, drawFootballPlan, allowedFootballClubIds } from './football-priority.js';

const players = new Map(data.players.map((player) => [player.id, player]));
const clubs = new Map(data.clubs.filter((club) => allowedFootballClubIds.has(club.id)).map((club) => [club.id, club]));
const dataVersion = (data.datasetId || data.fetchedAt) + ':clubs-v4';
const countryCounts = new Map();
const pairs = new Map();
const pairKey = (club, type, side) => `${club}:${type}:${side}`;
const normalize = (value) => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i');
const searchEntries = data.players.map((player) => ({ player, text: '|' + [player.name, ...(player.aliases || [])].map(normalize).join('|') + '|' }));

export function footballMediaKind(id) {
  if (!/^Q\d+$/.test(id)) return null;
  return clubs.has(id) ? 'club' : players.has(id) ? 'player' : null;
}

export function searchFootballPlayers(query) {
  const term = normalize(String(query || '').trim().slice(0, 60));
  if (!term) return [];
  const tokens = term.split(/\s+/), ranked = [[], [], [], []];
  const prefix = '|' + term, exact = prefix + '|';
  for (const { player, text } of searchEntries) {
    const score = text.includes(exact) ? 0 : text.includes(prefix) ? 1 : text.includes(term) ? 2 : tokens.length > 1 && tokens.every((token) => text.includes(token)) ? 3 : -1;
    if (score >= 0 && ranked[score].length < 35) ranked[score].push({ id: player.id, name: player.name });
  }
  return ranked.flat().slice(0, 35);
}

for (const player of data.players) {
  for (const country of player.countries) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  for (const club of player.clubs) {
    for (const [type, ids] of [['club', player.clubs], ['country', player.countries]]) {
      for (const side of ids) {
        if (type === 'club' && club === side) continue;
        const key = pairKey(club, type, side);
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push(player.id);
      }
    }
  }
}
const countries = new Map(data.countries.filter((c) => (countryCounts.get(c.id) || 0) >= 8).map((country) => [country.id, country]));

export function footballCatalog() {
  return {
    fetchedAt: data.fetchedAt, seasonCheckedAt: data.seasonCheckedAt, season: data.season, squadCount: data.squadCount, seasonPlayers: data.seasonPlayers, sources: data.sources, version: dataVersion, source: data.source, license: data.license,
    clubs: [...clubs.values()], countries: [...countries.values()], leagues: (data.leagues || []).map((league) => ({ ...league, clubCount: [...clubs.values()].filter((club) => club.league === league.id).length })).filter((league) => league.clubCount),
    playerCount: data.players.length
  };
}

export function cellCandidates(game, row, column) {
  return pairs.get(pairKey(game.topIds[column], game.mode === 'countries' ? 'country' : 'club', game.sideIds[row])) || [];
}

export function hasAvailableFootballMove(game) {
  const used = new Set(Object.values(game.playerPicks || {}));
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    if (!game.picks[`${row}-${column}`] && cellCandidates(game, row, column).some((id) => !used.has(id))) return true;
  }
  return false;
}

// Bipartite matching: a fresh board must have nine different valid answers.
export function boardHasSolution(game) {
  const cells = Array.from({ length: 9 }, (_, i) => cellCandidates(game, Math.floor(i / 3), i % 3));
  if (cells.some((ids) => !ids.length)) return false;
  const owner = new Map();
  function match(cell, visited) {
    for (const id of cells[cell]) {
      if (visited.has(id)) continue;
      visited.add(id);
      if (!owner.has(id) || match(owner.get(id), visited)) {
        owner.set(id, cell);
        return true;
      }
    }
    return false;
  }
  return cells.map((_, i) => i).sort((a, b) => cells[a].length - cells[b].length).every((cell) => match(cell, new Set()));
}

function shuffled(items, randomIndex) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createFootballBoard(options, randomIndex) {
  const mode = ['countries', 'superlig'].includes(options.mode) ? options.mode : 'clubs';
  const clubCatalog = mode === 'superlig' ? new Map([...clubs].filter(([, club]) => club.league === 'turkey')) : clubs;
  const sideCatalog = mode === 'countries' ? countries : clubCatalog;
  function finish(topIds, sideIds) {
    const game = { kind: 'xox', mode, topIds, sideIds, picks: {}, playerPicks: {}, boardId: crypto.randomUUID(), dataVersion };
    game.top = topIds.map((id) => clubs.get(id).name);
    game.side = sideIds.map((id) => sideCatalog.get(id).name);
    if (!boardHasSolution(game)) throw new Error('Bu seçimlerle dokuz farklı cevap bulunamıyor.');
    return game;
  }
  if (options.topIds !== undefined || options.sideIds !== undefined) {
    const { topIds, sideIds } = options;
    if (!Array.isArray(topIds) || !Array.isArray(sideIds) || topIds.length !== 3 || sideIds.length !== 3 ||
        new Set(topIds).size !== 3 || new Set(sideIds).size !== 3 ||
        topIds.some((id) => !clubCatalog.has(id)) || sideIds.some((id) => !sideCatalog.has(id)) ||
        (mode !== 'countries' && topIds.some((id) => sideIds.includes(id)))) {
      throw new Error('Farklı takım veya ülkeler seç.');
    }
    return finish([...topIds], [...sideIds]);
  }
  // Draw percentages once per board; failed solvability attempts keep this plan.
  const plan = drawFootballPlan(mode, randomIndex);
  const intersects = (a, b) => (pairs.get(pairKey(a, 'club', b)) || []).length > 0;
  const choose = (ids) => ids.length ? ids[randomIndex(ids.length)] : null;
  const foreignTopCount = 3 - Number(Boolean(plan.topTurkish));
  const foreignSideCount = 3 - Number(Boolean(plan.sideTurkish));
  const topTurkishPool = plan.topTurkish?.candidates.filter((id) => mode === 'countries' || plan.pool.filter((other) => intersects(id, other)).length >= foreignSideCount);
  const sideTurkishPool = plan.sideTurkish?.candidates.filter((id) => plan.pool.filter((other) => intersects(id, other)).length >= foreignTopCount);
  for (let attempt = 0; attempt < 1500; attempt++) {
    const topTurkish = plan.topTurkish ? choose(topTurkishPool) : null;
    if (plan.topTurkish && !topTurkish) continue;
    const sideTurkish = plan.sideTurkish ? choose(sideTurkishPool.filter((id) => id !== topTurkish && (!topTurkish || intersects(topTurkish, id)))) : null;
    if (plan.sideTurkish && !sideTurkish) continue;
    const topPool = sideTurkish ? plan.pool.filter((id) => intersects(id, sideTurkish)) : plan.pool;
    const topIds = sampleFootballClubs(topPool, foreignTopCount, randomIndex);
    if (topTurkish) topIds.splice(plan.topTurkish.slot, 0, topTurkish);
    if (topIds.length !== 3) continue;
    const sidePool = mode === 'countries' ? [...countries.keys()] : plan.pool;
    const eligible = sidePool.filter((id) =>
      !(mode !== 'countries' && topIds.includes(id)) &&
      topIds.every((top) => (pairs.get(pairKey(top, mode === 'countries' ? 'country' : 'club', id)) || []).length > 0)
    );
    if (eligible.length < foreignSideCount) continue;
    const sideIds = mode !== 'countries' ? sampleFootballClubs(eligible, foreignSideCount, randomIndex) : shuffled(eligible, randomIndex).slice(0, 3);
    if (sideTurkish) sideIds.splice(plan.sideTurkish.slot, 0, sideTurkish);
    try { return { ...finish(topIds, sideIds), selectionProfile: plan.profile }; } catch { /* Keep the same pool and Turkish slot. */ }
  }
  throw new Error('Tahta hazırlanamadı. Yeniden dene.');
}

export function validateFootballPick(game, { boardId, key, playerId }) {
  if (game?.dataVersion !== dataVersion) throw new Error('Futbolcu verisi yenilendi. Yeni tahta başlat.');
  if (!game?.boardId || boardId !== game.boardId) throw new Error('Tahta değişti. Hücreyi yeniden seç.');
  if (!/^[0-2]-[0-2]$/.test(String(key))) throw new Error('Geçersiz hücre.');
  if (game.picks[key]) throw new Error('Bu hücre zaten dolduruldu.');
  const player = players.get(playerId);
  const [row, column] = key.split('-').map(Number);
  if (!player || !cellCandidates(game, row, column).includes(playerId)) throw new Error('Bu futbolcu bu hücreye uymuyor.');
  if (Object.values(game.playerPicks || {}).includes(playerId)) throw new Error('Bu futbolcu tahtada zaten kullanıldı.');
  return player;
}
