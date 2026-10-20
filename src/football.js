import data from './data/football.json' with { type: 'json' };
import { sampleFootballClubs, drawFootballPlan, allowedFootballClubIds } from './football-priority.js';

const players = new Map(data.players.map((player) => [player.id, player]));
const clubs = new Map(data.clubs.filter((club) => allowedFootballClubIds.has(club.id)).map((club) => [club.id, club]));
const dataVersion = (data.datasetId || data.fetchedAt) + ':clubs-v3';
const countryCounts = new Map();
const pairs = new Map();
const pairKey = (club, type, side) => `${club}:${type}:${side}`;
const normalize = (value) => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i');
const searchEntries = data.players.map((player) => ({ player, text: normalize([player.name, ...(player.aliases || [])].join(' ')) }));

export function footballMediaKind(id) {
  return clubs.has(id) ? 'club' : players.has(id) ? 'player' : null;
}

export function searchFootballPlayers(query) {
  const term = normalize(String(query || '').trim().slice(0, 60));
  if (!term) return [];
  const results = [];
  for (const { player, text } of searchEntries) {
    if (text.includes(term)) results.push({ id: player.id, name: player.name });
    if (results.length === 35) break;
  }
  return results;
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
    fetchedAt: data.fetchedAt, version: dataVersion, source: data.source, license: data.license,
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
  const mode = options.mode === 'countries' ? 'countries' : 'clubs';
  const sideCatalog = mode === 'countries' ? countries : clubs;
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
        topIds.some((id) => !clubs.has(id)) || sideIds.some((id) => !sideCatalog.has(id)) ||
        (mode === 'clubs' && topIds.some((id) => sideIds.includes(id)))) {
      throw new Error('Farklı takım veya ülkeler seç.');
    }
    return finish([...topIds], [...sideIds]);
  }
  // Draw percentages once per board; failed solvability attempts keep this plan.
  const plan = drawFootballPlan(mode, randomIndex);
  // Some domestic clubs have no recorded overseas career intersections.
  // Retain them in the manual catalog, but only draw solvable random grids.
  if (plan.turkishId && mode === 'clubs') {
    plan.turkishCandidates = plan.turkishCandidates.filter((id) => plan.pool.filter((other) => (pairs.get(pairKey(id, 'club', other)) || []).length).length >= 3);
    if (!plan.turkishCandidates.includes(plan.turkishId)) plan.turkishId = plan.turkishCandidates[randomIndex(plan.turkishCandidates.length)];
    if (!plan.turkishId) throw new Error('Bu havuzda Türk takımlı tahta için yeterli kariyer verisi bulunamadı.');
  }
  for (let attempt = 0; attempt < 1500; attempt++) {
    if (attempt > 0 && attempt % 100 === 0 && plan.turkishCandidates.length > 1) plan.turkishId = plan.turkishCandidates[randomIndex(plan.turkishCandidates.length)];
    const topPool = plan.slot >= 3 ? plan.pool.filter((id) => (pairs.get(pairKey(id, 'club', plan.turkishId)) || []).length) : plan.pool;
    const topIds = sampleFootballClubs(topPool, plan.slot >= 0 && plan.slot < 3 ? 2 : 3, randomIndex);
    if (plan.slot >= 0 && plan.slot < 3) topIds.splice(plan.slot, 0, plan.turkishId);
    const sidePool = mode === 'countries' ? [...countries.keys()] : [...plan.pool, ...(plan.slot >= 3 ? [plan.turkishId] : [])];
    const eligible = sidePool.filter((id) =>
      !(mode === 'clubs' && topIds.includes(id)) &&
      topIds.every((top) => (pairs.get(pairKey(top, mode === 'countries' ? 'country' : 'club', id)) || []).length > 0)
    );
    if (eligible.length < 3) continue;
    if (plan.slot >= 3 && !eligible.includes(plan.turkishId)) continue;
    const sideIds = mode === 'clubs' ? sampleFootballClubs(eligible.filter((id) => id !== plan.turkishId), plan.slot >= 3 ? 2 : 3, randomIndex) : shuffled(eligible, randomIndex).slice(0, 3);
    if (plan.slot >= 3) sideIds.splice(plan.slot - 3, 0, plan.turkishId);
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
