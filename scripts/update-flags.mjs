import { writeFile } from 'node:fs/promises';
import { FLAG_COUNTRIES } from '../src/flag-data.js';
const headers = { 'User-Agent': 'WatchOutGames/1.0 (local flag assets)' };
async function request(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}
const commit = await (await request('https://api.github.com/repos/lipis/flag-icons/commits/main')).json();
if (!/^[a-f0-9]{40}$/.test(commit.sha || '')) throw new Error('Invalid source revision');
const base = `https://raw.githubusercontent.com/lipis/flag-icons/${commit.sha}/`;
await writeFile(new URL('../public/flags-LICENSE.txt', import.meta.url), await (await request(base + 'LICENSE')).text());
const artwork = {};
let position = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (position < FLAG_COUNTRIES.length) {
    const { code } = FLAG_COUNTRIES[position++];
    let svg = await (await request(`${base}flags/4x3/${code}.svg`)).text();
    if (!svg.includes('<svg') || /<script|<foreignObject|<image|\bon[a-z]+\s*=|(?:href|src)=["'](?:https?:|data:|javascript:)/i.test(svg)) throw new Error('Unsafe SVG ' + code);
    svg = svg.replace(/<!--[\s\S]*?-->|<(?:title|desc|metadata)\b[^>]*>[\s\S]*?<\/(?:title|desc|metadata)>/gi, '');
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    for (let n = 0; n < ids.length; n++) svg = svg.replaceAll(`id="${ids[n]}"`, `id="flagPart${n}"`).replaceAll(`#${ids[n]}"`, `#flagPart${n}"`).replaceAll(`#${ids[n]})`, `#flagPart${n})`);
    artwork[code] = svg;
  }
}));
await writeFile(new URL('../src/data/flags.json', import.meta.url), JSON.stringify(artwork));
await writeFile(new URL('../src/data/flags-source.json', import.meta.url), JSON.stringify({ source: 'https://github.com/lipis/flag-icons', revision: commit.sha, fetchedAt: new Date().toISOString(), license: 'MIT', count: FLAG_COUNTRIES.length }, null, 2));
console.log(`Saved ${FLAG_COUNTRIES.length} local flags, pinned revision ${commit.sha}.`);
