import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseCurrentSquad, parseCareer } from './football-season-import.mjs';

const root = new URL('../', import.meta.url);
const output = new URL('src/data/football-season.json', root);
const cacheRoot = new URL('.cache/football-season/', root);
const priority = JSON.parse(await readFile(new URL('src/data/football-priority.json', root), 'utf8'));
const base = JSON.parse(await readFile(new URL('src/data/football.json', root), 'utf8'));
const allowed = new Set(Object.values(priority.leagues).flat().map((club) => club.id));
const clubs = base.clubs.filter((club) => allowed.has(club.id));
const catalogHash = createHash('sha256').update(JSON.stringify({ ids: [...allowed].sort(), season: base.season, parser: 4 })).digest('hex');
const force = process.argv.includes('--force');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = { 'User-Agent': 'WatchOutGames/2.0 (football trivia; Wikimedia API reader)', Accept: 'application/json' };
await mkdir(cacheRoot, { recursive: true });
let oldest = Date.now();
let lastRequest = 0;
const pageCache = new Map();
if (!force) for (const file of await readdir(cacheRoot)) {
  if (!file.endsWith('.json')) continue;
  try {
    const cached = JSON.parse(await readFile(new URL(file, cacheRoot), 'utf8'));
    if (Date.now() - cached.at >= 24 * 3600000) continue;
    const found = new Map(Object.values(cached.data?.query?.pages || {}).map((page) => [page.title, page]));
    const aliases = new Map([...(cached.data?.query?.normalized || []), ...(cached.data?.query?.redirects || [])].map((entry) => [entry.from, entry.to]));
    for (const title of new Set([...found.keys(), ...aliases.keys()])) {
      let canonical = title; const seen = new Set();
      while (aliases.has(canonical) && !seen.has(canonical)) { seen.add(canonical); canonical = aliases.get(canonical); }
      const page = found.get(canonical), previous = pageCache.get(title);
      if (page && (!previous || page.revisions || !previous.page.revisions)) pageCache.set(title, { page, at: cached.at });
    }
  } catch {}
}
async function json(url) {
  const file = new URL(createHash('sha256').update(String(url)).digest('hex') + '.json', cacheRoot);
  if (!force) try {
    const cached = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - cached.at < 24 * 3600000) { oldest = Math.min(oldest, cached.at); return cached.data; }
  } catch {}
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await pause(Math.max(0, 1200 - (Date.now() - lastRequest))); lastRequest = Date.now();
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
      if (response.status === 429 || response.status === 503) {
        const delay = Math.min(60000, Math.max(1000, Number(response.headers.get('retry-after') || 15) * 1000));
        console.warn(`Wikimedia rate limit; waiting ${Math.ceil(delay / 1000)}s`);
        await pause(delay); continue;
      }
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.error) throw new Error(data.error.code + ': ' + data.error.info);
      await writeFile(file, JSON.stringify({ at: Date.now(), data })); return data;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn('Season source retry: ' + error.message); await pause(1500 * (attempt + 1));
    }
  }
  throw new Error('Wikimedia retry limit reached; previous season snapshot preserved.');
}
const api = (host, params) => { const url = new URL(`https://${host}/w/api.php`); url.search = new URLSearchParams({ ...params, format: 'json' }); return url; };
async function entities(ids) {
  const map = new Map();
  for (let offset = 0; offset < ids.length; offset += 40) {
    const data = await json(api('www.wikidata.org', { action: 'wbgetentities', ids: ids.slice(offset, offset + 40).join('|'), props: 'sitelinks', sitefilter: 'enwiki' }));
    for (const entity of Object.values(data.entities || {})) if (entity.sitelinks?.enwiki) map.set(entity.id, entity.sitelinks.enwiki.title);
  }
  return map;
}
async function pages(titles, revisions = false, batchSize = 50) {
  const map = new Map();
  const unique = [...new Set(titles.filter(Boolean))];
  for (const title of unique) {
    const cached = pageCache.get(title);
    if (cached && (!revisions || cached.page.revisions)) { map.set(title, cached.page); oldest = Math.min(oldest, cached.at); }
  }
  const pending = unique.filter((title) => !map.has(title));
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const params = { action: 'query', titles: pending.slice(offset, offset + batchSize).join('|'), prop: revisions ? 'pageprops|revisions' : 'pageprops', ppprop: 'wikibase_item', redirects: '1', ...(revisions ? { rvprop: 'content|ids|timestamp', rvslots: 'main' } : {}) };
    const data = await json(api('en.wikipedia.org', params));
    const aliases = new Map([...(data.query?.normalized || []), ...(data.query?.redirects || [])].map((entry) => [entry.from, entry.to]));
    const found = new Map(Object.values(data.query?.pages || {}).map((page) => [page.title, page]));
    for (const initial of pending.slice(offset, offset + batchSize)) {
      let title = initial; const visited = new Set();
      while (aliases.has(title) && !visited.has(title)) { visited.add(title); title = aliases.get(title); }
      const page = found.get(title); if (page && page.missing === undefined) { map.set(initial, page); pageCache.set(initial, { page, at: Date.now() }); pageCache.set(page.title, { page, at: Date.now() }); }
    }
    if (revisions) console.log(`Source pages ${map.size}/${unique.length}`);
    await pause(120);
  }
  return map;
}
async function run() {
  if (!force && process.argv.includes('--if-stale')) try {
    const previous = JSON.parse(await readFile(output, 'utf8'));
    if (previous.catalogHash === catalogHash && Date.now() - Date.parse(previous.fetchedAt) < 24 * 3600000) { console.log('Current-season career supplement is under 24 hours old; using checked snapshot.'); return; }
  } catch {}
  const clubTitles = await entities(base.clubs.map((club) => club.id));
  const clubPages = await pages([...clubTitles.values()], false, 25);
  const clubIdByTitle = new Map();
  for (const [id, title] of clubTitles) { clubIdByTitle.set(title, id); const page = clubPages.get(title); if (page) clubIdByTitle.set(page.title, id); }
  const squads = [], missing = [];
  for (const club of clubs) {
    const title = clubTitles.get(club.id);
    if (!title) throw new Error('No English source for ' + club.name);
    const result = await json(api('en.wikipedia.org', { action: 'parse', page: title, prop: 'text|revid', redirects: '1' }));
    const roster = parseCurrentSquad(result.parse?.text?.['*'] || '');
    console.log(`${club.name}: ${roster.length} current first-team players`);
    if (roster.length < 10) { missing.push({ id: club.id, name: club.name, title }); continue; }
    squads.push({ club: club.id, title, revision: result.parse.revid, roster });
    await pause(150);
  }
  if (missing.length) { await writeFile(new URL('missing-squads.json', cacheRoot), JSON.stringify(missing, null, 2)); throw new Error('Unparsed squads: ' + missing.map((c) => c.name).join(', ') + '; previous supplement preserved.'); }
  const allTitles = squads.flatMap((squad) => squad.roster.map((player) => player.title));
  const biographies = await pages(allTitles, true);
  const parsed = [], skipped = [];
  for (const [requestedTitle, page] of biographies) {
    const revision = page.revisions?.[0]; const id = page.pageprops?.wikibase_item;
    const career = parseCareer(revision?.slots?.main?.['*'] || '');
    if (!/^Q\d+$/.test(id || '') || !career) { skipped.push({ title: requestedTitle, reason: !id ? 'no-wikidata-id' : 'no-football-biography' }); continue; }
    parsed.push({ id, title: page.title, revision: revision.revid, revisionAt: revision.timestamp, ...career });
  }
  const careerTitles = [...new Set(parsed.flatMap((p) => p.career.map((c) => c.title)))];
  const resolvedCareers = await pages(careerTitles);
  for (const [title, page] of resolvedCareers) {
    const id = page.pageprops?.wikibase_item;
    if (base.clubs.some((c) => c.id === id)) { clubIdByTitle.set(title, id); clubIdByTitle.set(page.title, id); }
  }
  const codes = [...new Set(squads.flatMap((squad) => squad.roster.flatMap((player) => player.countryCodes || [])))];
  const flagPages = await pages(codes.map((code) => 'Template:Country data ' + code), true);
  const titleByCode = new Map();
  for (const code of codes) {
    const page = flagPages.get('Template:Country data ' + code);
    const alias = page?.revisions?.[0]?.slots?.main?.['*']?.match(/\|\s*alias\s*=\s*([^\n|}]+)/)?.[1]?.trim();
    if (alias && !/[{\[]/.test(alias)) titleByCode.set(code, alias);
  }
  const countryPages = await pages([...parsed.flatMap((p) => p.nations), ...titleByCode.values()]);
  const countryByTitle = new Map();
  for (const [title, page] of countryPages) if (/^Q\d+$/.test(page.pageprops?.wikibase_item || '')) countryByTitle.set(title, { id: page.pageprops.wikibase_item, name: page.title });
  const oldPlayers = new Map(base.players.map((p) => [p.id, p]));
  const rosterCountries = (squadPlayers) => [...new Set(squadPlayers.flatMap((p) => (p.countryCodes || []).map((code) => countryByTitle.get(titleByCode.get(code))?.id)).filter(Boolean))];
  const players = [];
  for (const entry of parsed) {
    const currentSquads = squads.filter((squad) => squad.roster.some((p) => biographies.get(p.title)?.pageprops?.wikibase_item === entry.id)).map((squad) => ({ club: squad.club, title: squad.title, revision: squad.revision }));
    const careerByClub = new Map();
    for (const stint of entry.career) {
      const club = clubIdByTitle.get(stint.title);
      if (!club) continue;
      careerByClub.set(club, (careerByClub.get(club) || 0) + stint.appearances);
    }
    const career = [...careerByClub].map(([club, appearances]) => ({ club, appearances }));
    if (!career.length && !currentSquads.length) { skipped.push({ title: entry.title, reason: 'no-covered-senior-club' }); continue; }
    const old = oldPlayers.get(entry.id);
    const aliases = [...new Set([entry.name, entry.title.replace(/ \([^)]*\)$/, ''), ...squads.flatMap((s) => s.roster.filter((p) => biographies.get(p.title)?.pageprops?.wikibase_item === entry.id).map((p) => p.name))])];
    const represented = [...new Set(entry.nations.map((nation) => countryByTitle.get(nation)?.id).filter(Boolean))];
    const countries = represented.length ? represented : rosterCountries(squads.flatMap((s) => s.roster.filter((p) => biographies.get(p.title)?.pageprops?.wikibase_item === entry.id)));
    players.push({ id: entry.id, name: old?.name || entry.name || entry.title, aliases, title: entry.title, revision: entry.revision, revisionAt: entry.revisionAt, updatedAt: entry.updatedAt, countries, career, currentSquads });
  }
  const uniquePlayers = [...new Map(players.map((p) => [p.id, p])).values()];
  // Unlinked academy graduates can still be registered first-team players.
  // Keep their real squad identity without inventing a Wikidata ID or a career.
  for (const squad of squads) for (const rosterPlayer of squad.roster) {
    const page = rosterPlayer.title ? biographies.get(rosterPlayer.title) : null;
    if (uniquePlayers.some((p) => page?.pageprops?.wikibase_item === p.id)) continue;
    const id = page?.pageprops?.wikibase_item || (page?.pageid ? 'WP:' + page.pageid : 'SQ:' + squad.club + ':' + createHash('sha256').update(rosterPlayer.name).digest('hex').slice(0, 12));
    const existing = uniquePlayers.find((p) => p.id === id);
    const registration = { club: squad.club, title: squad.title, revision: squad.revision };
    if (existing) existing.currentSquads.push(registration);
    else uniquePlayers.push({ id, name: rosterPlayer.name, aliases: [rosterPlayer.name], title: page?.title || squad.title, revision: page?.revisions?.[0]?.revid || squad.revision, countries: rosterCountries([rosterPlayer]), career: [], currentSquads: [registration] });
  }
  uniquePlayers.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const squadCoverage = squads.map((squad) => ({ club: squad.club, title: squad.title, revision: squad.revision, squadSize: squad.roster.length, importedPlayers: uniquePlayers.filter((p) => p.currentSquads.some((registration) => registration.club === squad.club)).length }));
  if (uniquePlayers.length < clubs.length * 15 || squadCoverage.some((c) => c.importedPlayers < 10)) throw new Error('Season supplement incomplete; previous snapshot preserved.');
  const fetchedAt = new Date(oldest).toISOString();
  const snapshot = { version: 1, season: base.season, fetchedAt, generatedAt: new Date().toISOString(), catalogHash, datasetId: createHash('sha256').update(JSON.stringify(uniquePlayers)).digest('hex').slice(0, 20), source: 'https://en.wikipedia.org/', license: 'CC-BY-SA-4.0', rule: 'Current senior-squad registration OR positive historical senior-career caps qualify a club answer. Registration evidence and appearance counts are stored separately; unknown counts are never invented. Senior national teams with positive caps define represented countries.', squadCoverage, skipped, countries: [...new Map([...countryByTitle.values()].map((country) => [country.id, country])).values()], players: uniquePlayers };
  const temporary = new URL('./football-season.json.tmp', output);
  await writeFile(temporary, JSON.stringify(snapshot)); await rename(temporary, output);
  console.log(`Saved ${uniquePlayers.length} checked current-player careers from ${squads.length} squads; ${skipped.length} unresolved records reported.`);
}
try { await run(); } catch (error) {
  let previous; try { previous = JSON.parse(await readFile(output, 'utf8')); } catch {}
  if (!process.argv.includes('--allow-stale-on-error') || !previous?.players?.length) throw error;
  console.warn('SEASON REFRESH FAILED: using previous checked supplement from ' + previous.fetchedAt + '. ' + error.message);
}
