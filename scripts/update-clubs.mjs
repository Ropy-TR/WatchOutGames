import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const config = JSON.parse(await readFile(new URL('./football-leagues.json', import.meta.url), 'utf8'));
const old = JSON.parse(await readFile(new URL('./football-clubs.json', import.meta.url), 'utf8'));
const oldNames = new Map(old.map((c) => [c.id, c.name]));
const headers = { 'User-Agent': 'WatchOutGames/1.0 (football trivia club catalog import)' };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cacheDirectory = new URL('../.cache/club-catalog/', import.meta.url);
await mkdir(cacheDirectory, { recursive: true });
async function getJson(url) {
  const cacheFile = new URL(createHash('sha256').update(String(url)).digest('hex') + '.json', cacheDirectory);
  try { const cache = JSON.parse(await readFile(cacheFile, 'utf8')); if (Date.now() - cache.savedAt < 86400000) return cache.result; } catch {}
  for (let n = 0; n < 4; n++) {
    await pause(500);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    if (response.ok) {
      const json = await response.json();
      if (!json.error) { await writeFile(cacheFile, JSON.stringify({ savedAt: Date.now(), result: json })); return json; }
      if (!['maxlag', 'ratelimited'].includes(json.error.code)) throw new Error(JSON.stringify(json.error));
    } else if (![429, 502, 503, 504].includes(response.status)) throw new Error(`HTTP ${response.status}`);
    await pause(Math.max(3000, Number(response.headers.get('retry-after') || 3) * 1000));
  }
  throw new Error('Wikimedia unavailable; club catalog unchanged.');
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const strip = (s) => decode(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const discovered = [];
for (const league of config.leagues) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'parse', page: league.page, prop: 'text', format: 'json', redirects: '1' });
  const result = await getJson(url);
  const html = result.parse.text['*'];
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((m) => m[0]);
  const candidates = tables.filter((t) => /class="[^"]*wikitable/.test(t) && /Stadium|Stadia|stadium|stadia/.test(t) && /Team|Club/.test(t));
  let entries = [];
  for (const table of candidates) {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const getCells = (row) => [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1]);
    const header = rows.map(getCells).find((cells) => cells.some((cell) => /^(Team|Club)(\s|\[|$)/.test(strip(cell))));
    const teamIndex = header?.findIndex((cell) => /^(Team|Club)(\s|\[|$)/.test(strip(cell))) ?? -1;
    if (teamIndex < 0) continue;
    const found = [];
    for (const row of rows) {
      const first = getCells(row)[teamIndex];
      if (!first) continue;
      const link = first.match(/<a\b[^>]*href="\/wiki\/([^"#]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (link && !link[1].includes(':')) found.push({ title: decodeURIComponent(link[1]).replaceAll('_', ' '), label: strip(link[2]), league: league.id });
    }
    const unique = [...new Map(found.map((c) => [c.title, c])).values()];
    if (unique.length >= 10 && unique.length <= 22) { entries = unique; break; }
  }
  if (!entries.length) throw new Error(`Could not identify the full team table for ${league.page}; catalog unchanged.`);
  discovered.push(...entries);
  league.clubCount = entries.length;
  league.source = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(league.page.replaceAll(' ', '_'));
  console.log(`${league.name}: ${entries.length} clubs`);
}
const resolved = new Map();
for (let i = 0; i < discovered.length; i += 50) {
  const batch = discovered.slice(i, i + 50);
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', titles: batch.map((c) => c.title).join('|'), prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', format: 'json' });
  const result = await getJson(url);
  const aliases = new Map([...(result.query.normalized || []), ...(result.query.redirects || [])].map((m) => [m.from, m.to]));
  const pages = new Map(Object.values(result.query.pages).map((p) => [p.title, p.pageprops?.wikibase_item]));
  for (const club of batch) {
    let canonical = club.title;
    const visited = new Set();
    while (aliases.has(canonical) && !visited.has(canonical)) { visited.add(canonical); canonical = aliases.get(canonical); }
    const id = pages.get(canonical);
    if (id) resolved.set(club.title, { id });
  }
}
const clubs = discovered.map((club) => {
  const entity = resolved.get(club.title);
  if (!entity) throw new Error(`Missing Wikidata entity for ${club.title}; catalog unchanged.`);
  return { id: entity.id, name: oldNames.get(entity.id) || entity.labels?.tr?.value || entity.labels?.en?.value || club.label, league: club.league };
});
if (new Set(clubs.map((c) => c.id)).size !== clubs.length) throw new Error('Duplicate club IDs; catalog unchanged.');
config.clubsFetchedAt = new Date().toISOString();
await writeFile(new URL('./football-clubs.json', import.meta.url), JSON.stringify(clubs, null, 2) + '\n');
await writeFile(new URL('./football-leagues.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log(`Saved ${clubs.length} clubs across ${config.leagues.length} leagues.`);
