import data from './data/lol.json' with { type: 'json' };

const champions = new Map(data.champions.map((champion) => [champion.id, champion]));
const attributes = new Map(data.attributes.map((attribute) => [attribute.id, attribute]));
const members = new Map(data.attributes.map((attribute) => [attribute.id, new Set()]));
for (const champion of data.champions) for (const attribute of champion.attributes) members.get(attribute).add(champion.id);
const pairs = new Map();
export const LOL_MODES = [
  { id: 'mixed', label: 'Karışık', topTypes: ['region', 'origin', 'species'], sideTypes: ['lane', 'class'] },
  { id: 'region-lane', label: 'Bölge × Koridor', topTypes: ['region'], sideTypes: ['lane'] },
  { id: 'species-lane', label: 'Tür × Koridor', topTypes: ['species'], sideTypes: ['lane'] },
  { id: 'region-class', label: 'Bölge × Sınıf', topTypes: ['region'], sideTypes: ['class'] },
  { id: 'origin-lane', label: 'Köken × Koridor', topTypes: ['origin'], sideTypes: ['lane'] }
];
export const lolDataVersion = data.datasetId;
export function lolCatalog() {
  return { version: lolDataVersion, patch: data.patch, fetchedAt: data.fetchedAt, sources: data.sources,
    championCount: champions.size, champions: data.champions.map(({ id, name, icon }) => ({ id, name, icon })),
    modes: LOL_MODES.map(({ id, label }) => ({ id, label })), attributes: data.attributes.map((attribute) => ({ ...attribute, count: members.get(attribute.id).size })) };
}
const normalize = (value) => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i').replace(/[^a-z0-9]/g, '');
const searchIndex = data.champions.map((champion) => ({ champion, terms: [champion.name, ...champion.aliases].map(normalize) }));
export function searchLolChampions(query) {
  const term = normalize(String(query || '').trim().slice(0, 60));
  if (!term) return [];
  return searchIndex.filter(({ terms }) => terms.some((text) => text.includes(term))).slice(0, 35).map(({ champion: { id, name, icon } }) => ({ id, name, icon }));
}
function candidates(top, side) {
  const key = [top, side].sort().join('|');
  if (!pairs.has(key)) pairs.set(key, [...(members.get(top) || [])].filter((id) => members.get(side)?.has(id)));
  return pairs.get(key);
}
export function lolCellCandidates(game, row, column) { return candidates(game.topIds[column], game.sideIds[row]); }
export function lolBoardHasSolution(game) {
  const cells = Array.from({ length: 9 }, (_, n) => lolCellCandidates(game, Math.floor(n / 3), n % 3)).sort((a, b) => a.length - b.length);
  const owner = new Map();
  function match(cell, visited) {
    for (const id of cells[cell]) {
      if (visited.has(id)) continue; visited.add(id);
      if (!owner.has(id) || match(owner.get(id), visited)) { owner.set(id, cell); return true; }
    }
    return false;
  }
  return cells.every((_, n) => match(n, new Set()));
}
function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = random(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function createLolBoard(options, random) {
  const mode = LOL_MODES.find((mode) => mode.id === options.mode) || LOL_MODES[0];
  const topPool = data.attributes.filter((a) => mode.topTypes.includes(a.type) && members.get(a.id).size >= 3).map((a) => a.id);
  const sidePool = data.attributes.filter((a) => mode.sideTypes.includes(a.type) && members.get(a.id).size >= 3).map((a) => a.id);
  function finish(topIds, sideIds) {
    const game = { kind: 'lol-xox', mode: mode.id, boardId: crypto.randomUUID(), dataVersion: lolDataVersion,
      topIds, sideIds, top: topIds.map((id) => attributes.get(id).label), side: sideIds.map((id) => attributes.get(id).label), picks: {}, playerPicks: {} };
    if (!lolBoardHasSolution(game)) throw new Error('Bu seçimlerle dokuz farklı şampiyon bulunamıyor.');
    return game;
  }
  if (options.topIds !== undefined || options.sideIds !== undefined) {
    const { topIds, sideIds } = options;
    if (!Array.isArray(topIds) || !Array.isArray(sideIds) || topIds.length !== 3 || sideIds.length !== 3 || new Set(topIds).size !== 3 || new Set(sideIds).size !== 3 || topIds.some((id) => !topPool.includes(id)) || sideIds.some((id) => !sidePool.includes(id))) throw new Error('Geçersiz özellik seçimi.');
    return finish([...topIds], [...sideIds]);
  }
  for (let attempt = 0; attempt < 600; attempt++) {
    const topIds = shuffled(topPool, random).slice(0, 3);
    const eligible = sidePool.filter((side) => topIds.every((top) => candidates(top, side).length));
    if (eligible.length < 3) continue;
    const sideIds = shuffled(eligible, random).slice(0, 3);
    try { return finish(topIds, sideIds); } catch { /* Reject impossible grids. */ }
  }
  throw new Error('LoL tahtası hazırlanamadı. Yeniden dene.');
}
export function validateLolPick(game, { boardId, key, championId }) {
  if (game.dataVersion !== lolDataVersion) throw new Error('Şampiyon verisi yenilendi. Yeni seri başlat.');
  if (boardId !== game.boardId) throw new Error('Tahta değişti.');
  if (!/^[0-2]-[0-2]$/.test(String(key))) throw new Error('Geçersiz hücre.');
  if (game.picks[key]) throw new Error('Bu hücre zaten dolduruldu.');
  const champion = champions.get(championId), [row, column] = key.split('-').map(Number);
  if (!champion || !lolCellCandidates(game, row, column).includes(championId)) throw new Error('Bu şampiyon iki özelliğe birden uymuyor.');
  if (Object.values(game.playerPicks).includes(championId)) throw new Error('Bu şampiyon tahtada zaten kullanıldı.');
  return champion;
}
export function hasAvailableLolMove(game) {
  const used = new Set(Object.values(game.playerPicks));
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) if (!game.picks[`${row}-${column}`] && lolCellCandidates(game, row, column).some((id) => !used.has(id))) return true;
  return false;
}
