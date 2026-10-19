// No dependencies or API key. Run with Node 20+: node scripts/update-football.mjs
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = new URL('../src/data/football.json', import.meta.url);

async function updateFootball() {
const clubs = JSON.parse(await readFile(new URL('./football-clubs.json', import.meta.url), 'utf8'));
const leagueConfig = JSON.parse(await readFile(new URL('./football-leagues.json', import.meta.url), 'utf8'));
const catalogHash = createHash('sha256').update(JSON.stringify({ clubs, leagues: leagueConfig.leagues, ruleVersion: 2 })).digest('hex');
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch {}
if (process.argv.includes('--if-stale')) {
  try {
    const current = JSON.parse(await readFile(output, 'utf8'));
    if (current.catalogHash === catalogHash && current.version === 1 && current.players?.length >= 200 && Date.now() - Date.parse(current.fetchedAt) < 86400000) {
      console.log('Wikidata snapshot is under 24 hours old; using the existing data.');
      return;
    }
  } catch { /* Fetch a new snapshot when none is available. */ }
}
const headers = {
  'User-Agent': 'WatchOutGames/1.0 (open-source football trivia; data importer)',
  Accept: 'application/sparql-results+json'
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cacheDirectory = new URL('../.cache/wikidata/', import.meta.url);
await mkdir(cacheDirectory, { recursive: true });
let oldestFetch = Date.now();

async function requestJson(url) {
  const cachePath = new URL(createHash('sha256').update(String(url)).digest('hex') + '.json', cacheDirectory);
  try {
    const cache = JSON.parse(await readFile(cachePath, 'utf8'));
    if (Date.now() - cache.savedAt < 86400000) {
      oldestFetch = Math.min(oldestFetch, cache.savedAt);
      return cache.result;
    }
  } catch { /* A missing cache is expected on the first run. */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      // A 500-entity label query can exceed a proxy's URL length limit.
      const usePost = url.hostname === 'query.wikidata.org' && String(url).length > 6000;
      response = await fetch(usePost ? `${url.origin}${url.pathname}` : url, {
        headers: usePost ? { ...headers, 'content-type': 'application/x-www-form-urlencoded' } : headers,
        ...(usePost ? { method: 'POST', body: url.searchParams.toString() } : {}),
        signal: AbortSignal.timeout(60000)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.error?.code === 'maxlag' || result.error?.code === 'ratelimited') {
          console.warn(`Wikidata ${result.error.code}; respecting Retry-After`);
          await pause(Math.max(5000, Number(response.headers.get('retry-after') || 5) * 1000));
          continue;
        }
        if (result.error) throw new Error(`Wikidata API: ${result.error.code}`);
        await writeFile(cachePath, JSON.stringify({ savedAt: Date.now(), result }));
        return result;
      }
      if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`Wikidata HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 3 || (response && response.status >= 400 && response.status < 500 && response.status !== 429)) throw error;
    }
    const retryAfter = response?.headers.get('retry-after');
    const wait = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : 2000 * (attempt + 1);
    console.warn(`Wikidata busy; retrying in ${Math.ceil(Math.max(1000, wait) / 1000)}s`);
    await pause(Number.isFinite(wait) ? Math.max(1000, wait) : 5000);
  }
  throw new Error('Wikidata unavailable; existing data has been preserved.');
}

const players = new Map();
const countries = new Map();
const id = (binding) => binding?.value?.split('/').at(-1);
for (let offset = 0; offset < clubs.length; offset += 3) {
  const batch = clubs.slice(offset, offset + 3);
  console.log(`Fetching ${batch.map((c) => c.name).join(', ')}`);
  const query = `SELECT DISTINCT ?player ?team ?country ?appearances ?membership WHERE {
    VALUES ?team { ${batch.map((club) => `wd:${club.id}`).join(' ')} }
    ?player p:P54 ?membership .
    ?membership ps:P54 ?team ; pq:P1350 ?appearances .
    FILTER(?appearances > 0)
    FILTER(EXISTS { ?player wdt:P106/wdt:P279* wd:Q937857 } || EXISTS { ?player wdt:P641 wd:Q2736 })
    FILTER NOT EXISTS { ?membership wikibase:rank wikibase:DeprecatedRank }
    OPTIONAL { ?player wdt:P1532 ?country }
  }`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.search = new URLSearchParams({ query, format: 'json' });
  const result = await requestJson(url);
  const rows = result.results?.bindings;
  if (!Array.isArray(rows)) throw new Error('Unexpected Wikidata response; existing snapshot preserved.');
  for (const row of rows) {
    const playerId = id(row.player), clubId = id(row.team), countryId = id(row.country);
    if (!/^Q\d+$/.test(playerId || '')) continue;
    if (!players.has(playerId)) players.set(playerId, { id: playerId, name: '', aliases: [], clubs: new Set(), countries: new Set(), memberships: new Map() });
    const player = players.get(playerId);
    player.clubs.add(clubId);
    // Keep only sporting nationality. Citizenship (P27) is deliberately not substituted.
    if (countryId) {
      player.countries.add(countryId);
      countries.set(countryId, { id: countryId, name: '' });
    }
    const statement = row.membership.value.replace('http://www.wikidata.org/entity/statement/', '');
    player.memberships.set(statement, { club: clubId, appearances: Number(row.appearances.value), statement });
  }
  console.log(`  ${rows.length} rows; ${players.size} unique players so far`);
}

const reuseLabels = previous && Date.now() - Date.parse(previous.labelsFetchedAt || previous.fetchedAt) < 30 * 86400000;
if (reuseLabels) {
  for (const cached of previous.players) if (players.has(cached.id)) {
    players.get(cached.id).name = cached.name;
    players.get(cached.id).aliases = cached.aliases || [];
  }
  for (const cached of previous.countries) if (countries.has(cached.id)) countries.get(cached.id).name = cached.name;
}
const ids = [...players.values(), ...countries.values()].filter((item) => !item.name).map((item) => item.id).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
for (let offset = 0; offset < ids.length; offset += 500) {
  const url = new URL('https://query.wikidata.org/sparql');
  const query = `SELECT ?entity ?value ?property WHERE {
    VALUES ?entity { ${ids.slice(offset, offset + 500).map((id) => `wd:${id}`).join(' ')} }
    VALUES ?property { rdfs:label skos:altLabel }
    ?entity ?property ?value . FILTER(LANG(?value) = "en" || LANG(?value) = "tr")
  }`;
  url.search = new URLSearchParams({ query, format: 'json' });
  const result = await requestJson(url);
  if (!Array.isArray(result.results?.bindings)) throw new Error('Label import failed; previous snapshot preserved.');
  const entities = new Map();
  for (const row of result.results.bindings) {
    const entityId = id(row.entity);
    if (!entities.has(entityId)) entities.set(entityId, { id: entityId, labels: {}, aliases: [] });
    const entity = entities.get(entityId);
    if (row.property.value.endsWith('#label')) entity.labels[row.value['xml:lang']] = row.value.value;
    else entity.aliases.push(row.value.value);
  }
  for (const entity of entities.values()) {
    const name = entity.labels.tr || entity.labels.en;
    if (!name || /^Q\d+$/.test(name)) continue;
    const player = players.get(entity.id);
    if (player) {
      player.name = name;
      player.aliases = [...new Set([entity.labels.en, ...entity.aliases].filter((alias) => alias && alias !== name))].sort().slice(0, 12);
    }
    if (countries.has(entity.id)) countries.get(entity.id).name = name;
  }
  console.log(`Labels ${Math.min(ids.length, offset + 500)} / ${ids.length}`);
  await pause(200);
}
const validCountries = new Set([...countries.values()].filter((c) => c.name).map((c) => c.id));
const list = [...players.values()].filter((p) => p.name).map((player) => ({
  id: player.id, name: player.name,
  aliases: player.aliases,
  clubs: [...player.clubs].sort(), countries: [...player.countries].filter((id) => validCountries.has(id)).sort(),
  memberships: [...player.memberships.values()].sort((a,b) => a.statement.localeCompare(b.statement)).map(({ club, appearances }) => ({ club, appearances }))
})).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const covered = new Set(list.flatMap((player) => player.clubs));
if (list.length < 200 || covered.size < clubs.length * 0.8) {
  throw new Error('Incomplete import; existing snapshot has been preserved.');
}
const datasetId = createHash('sha256').update(JSON.stringify({ clubs, players: list, countries: [...validCountries] })).digest('hex').slice(0, 20);
const snapshot = {
  version: 1, fetchedAt: new Date(oldestFetch).toISOString(), generatedAt: new Date().toISOString(), source: 'https://www.wikidata.org/', license: 'CC0-1.0',
  rule: 'Association football players; exact senior-club P54 statements with positive P1350 appearances; P1532 sporting nationality only. Data may be incomplete.',
  catalogHash, datasetId,
  labelsFetchedAt: reuseLabels ? (previous.labelsFetchedAt || previous.fetchedAt) : new Date().toISOString(),
  season: leagueConfig.season, leagues: leagueConfig.leagues,
  clubsWithoutMatchData: clubs.filter((club) => !covered.has(club.id)).map((club) => club.id),
  clubs, countries: [...countries.values()].filter((c) => c.name).sort((a,b) => a.name.localeCompare(b.name, 'tr')),
  players: list
};
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
const temporary = new URL('./football.json.tmp', output);
await writeFile(temporary, JSON.stringify(snapshot));
await rename(temporary, output);
console.log(`Saved ${list.length} players, ${clubs.length} clubs, ${countries.size} countries to src/data/football.json`);

}
try {
  await updateFootball();
} catch (error) {
  let existing;
  try { existing = JSON.parse(await readFile(output, 'utf8')); } catch {}
  if (!process.argv.includes('--allow-stale-on-error') || existing?.version !== 1 || !(existing.players?.length >= 200)) throw error;
  console.warn('Wikidata refresh failed; deploying the previous snapshot from ' + existing.fetchedAt + '. ' + error.message);
}
