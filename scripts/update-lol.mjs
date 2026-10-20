import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildLolSnapshot, parseChampionLua } from './lol-import.mjs';
const output = new URL('../src/data/lol.json', import.meta.url);
const cacheDir = new URL('../.cache/lol-import/', import.meta.url);
let previous;
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch {}
if (process.argv.includes('--if-stale') && previous?.schema === 1 && Date.now() - Date.parse(previous.fetchedAt) < 86400000) {
  console.log('LoL snapshot is under 24 hours old; using existing data.');
} else {
  try {
    await mkdir(cacheDir, { recursive: true });
    let oldestFetch = Date.now();
    async function request(url, raw = false) {
      const path = new URL(createHash('sha256').update(url).digest('hex') + '.json', cacheDir);
      try { const cached = JSON.parse(await readFile(path, 'utf8')); if (Date.now() - cached.time < 86400000) { oldestFetch = Math.min(oldestFetch, cached.time); return cached.body; } } catch {}
      let error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(url, { headers: { 'User-Agent': 'WatchOutGames/1.0 (champion metadata importer)' }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
          const body = raw ? await response.text() : await response.json();
          if (body?.error) throw new Error(body.error.info || body.error.code);
          await writeFile(path, JSON.stringify({ time: Date.now(), body })); return body;
        } catch (cause) { error = cause; if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); }
      }
      throw error;
    }
    const versionUrl = 'https://ddragon.leagueoflegends.com/api/versions.json';
    const patch = (await request(versionUrl))[0];
    if (!/^\d+\.\d+\.\d+$/.test(patch)) throw new Error('Invalid Data Dragon version');
    const riotUrl = `https://ddragon.leagueoflegends.com/cdn/${patch}/data/tr_TR/champion.json`;
    const wikiUrl = 'https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw';
    const [riot, lua] = await Promise.all([request(riotUrl), request(wikiUrl, true)]);
    const records = parseChampionLua(lua);
    const titles = [...new Set(Object.values(riot.data).flatMap((champion) => {
      const entry = records.get(champion.key); if (!entry) throw new Error('Champion missing from wiki: ' + champion.id);
      return champion.id === 'Nunu' ? ['Universe:Nunu', 'Universe:Willump'] : ['Universe:' + entry.name];
    }))];
    const pages = [], redirects = [];
    for (let offset = 0; offset < titles.length; offset += 20) {
      const url = new URL('https://wiki.leagueoflegends.com/en-us/api.php');
      url.search = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content|timestamp|ids', rvslots: 'main', formatversion: '2', format: 'json', redirects: '1', maxlag: '10', titles: titles.slice(offset, offset + 20).join('|') });
      const data = await request(url.href);
      if (!data.query?.pages) throw new Error('Invalid wiki biography response');
      pages.push(...data.query.pages); redirects.push(...(data.query.redirects || []));
    }
    const snapshot = buildLolSnapshot({ riot, lua, pages, redirects, fetchedAt: new Date(oldestFetch).toISOString(), sources: { roster: riotUrl, gameplay: wikiUrl, lore: 'https://wiki.leagueoflegends.com/en-us/Universe:Main_Page', license: 'https://creativecommons.org/licenses/by-sa/3.0/' } });
    snapshot.datasetId = createHash('sha256').update(JSON.stringify({ patch, champions: snapshot.champions, attributes: snapshot.attributes })).digest('hex').slice(0, 24);
    await writeFile(new URL('../src/data/lol.json.tmp', import.meta.url), JSON.stringify(snapshot));
    await rename(new URL('../src/data/lol.json.tmp', import.meta.url), output);
    console.log(`Imported all ${snapshot.champions.length} Riot champions (${patch}) with LoL Wiki attributes.`);
  } catch (error) {
    if (process.argv.includes('--allow-stale-on-error') && previous?.schema === 1 && previous.champions?.length >= 170) console.warn('LoL refresh unavailable; retaining snapshot from ' + previous.fetchedAt + ': ' + error.message);
    else { console.error('LoL import failed: ' + error.message); process.exitCode = 1; }
  }
}
