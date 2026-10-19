import { footballMediaKind } from './football.js';

const headers = { 'User-Agent': 'WatchOutGames/1.0 (football trivia image metadata lookup)' };
const plain = (value) => String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi, (entity) => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const number = entity.slice(2, -1);
  const code = number.startsWith('x') ? parseInt(number.slice(1), 16) : Number(number);
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).trim().slice(0, 1200);

function safeUrl(value, hosts) {
  try {
    const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
    if (!['http:', 'https:'].includes(url.protocol) || !hosts.includes(url.hostname) || url.username || url.password) return null;
    url.protocol = 'https:';
    return url.href;
  } catch { return null; }
}

export function commonsImage(info) {
  if (!info || !/^image\/(?:jpeg|png|webp|svg\+xml)$/.test(info.mime || '')) return null;
  const meta = info.extmetadata || {};
  const license = plain(meta.LicenseShortName?.value || meta.UsageTerms?.value);
  // Use freely reusable files; never import Wikipedia's non-free fair-use images.
  if (/\bNC\b|\bND\b|fair.use|non.free/i.test(license) || !/^(?:CC BY(?:-SA)?(?:\s|$)|CC0(?:\s|$)|Public domain|PD(?:-|\s|$))/i.test(license)) return null;
  const src = safeUrl(info.thumburl || info.url, ['upload.wikimedia.org', 'thumb.wikimedia.org']);
  const source = safeUrl(info.descriptionurl, ['commons.wikimedia.org']);
  const licenseUrl = safeUrl(meta.LicenseUrl?.value, ['creativecommons.org', 'www.creativecommons.org', 'commons.wikimedia.org']);
  const author = plain(meta.Artist?.value);
  if (!src || !source || ((!author || !licenseUrl) && /^CC BY/i.test(license))) return null;
  return { src, source, license, licenseUrl, author: author || 'Wikimedia Commons' };
}

function pickFile(entity, property) {
  return (entity?.claims?.[property] || [])
    .filter((claim) => claim.rank !== 'deprecated' && typeof claim.mainsnak?.datavalue?.value === 'string')
    .sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'))[0]?.mainsnak.datavalue.value;
}

export async function lookupFootballMedia(ids, options = {}) {
  const fetcher = options.fetcher || fetch;
  const cache = options.cache;
  const origin = options.origin || 'https://watchout-games.invalid';
  const items = {};
  const missing = [];
  const keys = new Map();
  for (const id of ids) {
    const key = new Request(`${origin}/api/football/media-cache/v1/${id}`);
    keys.set(id, key);
    try {
      const cached = cache && await cache.match(key);
      if (cached) { items[id] = await cached.json(); continue; }
    } catch { /* Cache failures must not prevent playing. */ }
    missing.push(id);
  }
  if (!missing.length) return items;
  async function getJson(url) {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`Media metadata HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error('Media metadata unavailable');
    return data;
  }
  try {
    const entityUrl = new URL('https://www.wikidata.org/w/api.php');
    entityUrl.search = new URLSearchParams({ action: 'wbgetentities', ids: missing.join('|'), props: 'claims', format: 'json', maxlag: '10' });
    const entities = (await getJson(entityUrl)).entities;
    if (!entities) throw new Error('Missing image entities');
    const files = new Map();
    for (const id of missing) {
      const kind = footballMediaKind(id);
      const file = pickFile(entities[id], kind === 'club' ? 'P154' : 'P18');
      if (file && file.length < 240) files.set(id, `File:${file.replaceAll('_', ' ')}`);
      items[id] = null;
    }
    if (files.size) {
      const commonsUrl = new URL('https://commons.wikimedia.org/w/api.php');
      commonsUrl.search = new URLSearchParams({ action: 'query', titles: [...new Set(files.values())].join('|'), redirects: '1', prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '120', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|UsageTerms', format: 'json' });
      const result = await getJson(commonsUrl);
      if (!result.query?.pages) throw new Error('Missing Commons metadata');
      const redirects = new Map([...(result.query.normalized || []), ...(result.query.redirects || [])].map((entry) => [entry.from, entry.to]));
      const pages = new Map(Object.values(result.query.pages).map((page) => [page.title, page]));
      for (const [id, initial] of files) {
        let title = initial;
        const seen = new Set();
        while (redirects.has(title) && !seen.has(title)) { seen.add(title); title = redirects.get(title); }
        items[id] = commonsImage(pages.get(title)?.imageinfo?.[0]);
      }
    }
    if (cache) {
      const save = Promise.allSettled(missing.map((id) => cache.put(keys.get(id), new Response(JSON.stringify(items[id]), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${items[id] ? 604800 : 86400}` }
      }))));
      if (options.waitUntil) options.waitUntil(save);
      else await save;
    }
  } catch {
    // Transient upstream failures are not stored as missing images.
    for (const id of missing) items[id] = null;
  }
  return items;
}
