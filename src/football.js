import data from './data/football.json' with { type: 'json' };

const players = new Map(data.players.map((player) => [player.id, player]));
const clubs = new Map(data.clubs.map((club) => [club.id, club]));
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
    fetchedAt: data.fetchedAt, version: data.datasetId || data.fetchedAt, source: data.source, license: data.license,
    clubs: data.clubs, countries: [...countries.values()], leagues: data.leagues || [],
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
    const game = { kind: 'xox', mode, topIds, sideIds, picks: {}, playerPicks: {}, boardId: crypto.randomUUID(), dataVersion: data.datasetId || data.fetchedAt };
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
  for (let attempt = 0; attempt < 400; attempt++) {
    const topIds = shuffled([...clubs.keys()], randomIndex).slice(0, 3);
    const eligible = [...sideCatalog.keys()].filter((id) =>
      !(mode === 'clubs' && topIds.includes(id)) &&
      topIds.every((top) => (pairs.get(pairKey(top, mode === 'countries' ? 'country' : 'club', id)) || []).length > 0)
    );
    if (eligible.length < 3) continue;
    const sideIds = shuffled(eligible, randomIndex).slice(0, 3);
    try { return finish(topIds, sideIds); } catch { /* Try a different solvable board. */ }
  }
  throw new Error('Tahta hazırlanamadı. Yeniden dene.');
}

export function validateFootballPick(game, { boardId, key, playerId }) {
  if (game?.dataVersion !== (data.datasetId || data.fetchedAt)) throw new Error('Futbolcu verisi yenilendi. Yeni tahta başlat.');
  if (!game?.boardId || boardId !== game.boardId) throw new Error('Tahta değişti. Hücreyi yeniden seç.');
  if (!/^[0-2]-[0-2]$/.test(String(key))) throw new Error('Geçersiz hücre.');
  if (game.picks[key]) throw new Error('Bu hücre zaten dolduruldu.');
  const player = players.get(playerId);
  const [row, column] = key.split('-').map(Number);
  if (!player || !cellCandidates(game, row, column).includes(playerId)) throw new Error('Bu futbolcu bu hücreye uymuyor.');
  if (Object.values(game.playerPicks || {}).includes(playerId)) throw new Error('Bu futbolcu tahtada zaten kullanıldı.');
  return player;
}
