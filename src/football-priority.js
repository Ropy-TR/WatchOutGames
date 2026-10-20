import priority from './data/football-priority.json' with { type: 'json' };

const preferred = new Set(Object.values(priority.leagues).flat().map((club) => club.id));
export const allowedFootballClubIds = preferred;
const turkish = new Set(priority.leagues.turkey.map((club) => club.id));
export function drawFootballPlan(mode, randomIndex) {
  if (mode === 'superlig') return { profile: 'superlig', pool: [...turkish], topTurkish: null, sideTurkish: null };
  const elite = randomIndex(100) < priority.eliteBoardPercent;
  const withSide = mode === 'clubs' && randomIndex(100) < priority.turkishSidePercent;
  const withTop = randomIndex(100) < (mode === 'countries' ? priority.turkishBoardPercent : priority.turkishTopPercent);
  function axis(include) {
    if (!include) return null;
    const bigFour = randomIndex(100) < priority.turkishBigFourPercent;
    const fourIds = priority.turkishBigFour.map((club) => club.id);
    const candidates = bigFour ? fourIds : [...turkish].filter((id) => !fourIds.includes(id));
    return { candidates, group: bigFour ? 'big-four' : 'other', slot: randomIndex(3) };
  }
  const sideTurkish = axis(withSide), topTurkish = axis(withTop);
  return {
    profile: elite ? 'elite' : 'selected-clubs',
    pool: [...(elite ? priority.worldTop30.map((club) => club.id) : preferred)].filter((id) => preferred.has(id) && !turkish.has(id)),
    topTurkish, sideTurkish
  };
}
export const clubDrawWeight = (id) => preferred.has(id) ? priority.weight : 1;

// Weighted tickets, without replacement. The caller supplies the server's secure RNG.
// Only the caller's already restricted pool is eligible.
export function sampleFootballClubs(ids, count, randomIndex) {
  const pool = [...new Set(ids)].map((id) => ({ id, weight: clubDrawWeight(id) }));
  const selected = [];
  while (selected.length < count && pool.length) {
    const total = pool.reduce((sum, club) => sum + club.weight, 0);
    let ticket = randomIndex(total);
    const index = pool.findIndex((club) => { ticket -= club.weight; return ticket < 0; });
    if (index < 0) throw new Error('Geçersiz rastgele seçim.');
    selected.push(pool.splice(index, 1)[0].id);
  }
  return selected;
}
