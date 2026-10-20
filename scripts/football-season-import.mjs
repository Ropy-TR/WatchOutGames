// Wikipedia content is parsed as data; no remote templates or scripts are executed.
export const cleanWiki = (text) => String(text || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<ref\b[^>]*\/>/gi, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
export const decodeHtml = (text) => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;|&#160;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const plain = (text) => decodeHtml(text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
export function splitWiki(text, delimiter = '|') {
  let braces = 0, links = 0, start = 0; const parts = [];
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === '{{') { braces++; i++; }
    else if (pair === '}}') { braces--; i++; }
    else if (pair === '[[') { links++; i++; }
    else if (pair === ']]') { links--; i++; }
    else if (text[i] === delimiter && !braces && !links) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start)); return parts;
}
export function footballBiography(raw) {
  const text = cleanWiki(raw), start = /\{\{\s*Infobox (?:football|soccer) biography\s*\|/i.exec(text);
  if (!start) return null;
  let depth = 1, end = start.index + 2;
  for (; end < text.length - 1; end++) {
    const pair = text.slice(end, end + 2);
    if (pair === '{{') { depth++; end++; }
    else if (pair === '}}') { depth--; if (!depth) break; end++; }
  }
  if (depth) throw new Error('Unclosed football biography');
  return Object.fromEntries(splitWiki(text.slice(start.index + 2, end)).slice(1).flatMap((part) => {
    const equals = part.indexOf('=');
    return equals < 0 ? [] : [[part.slice(0, equals).trim().toLowerCase(), part.slice(equals + 1).trim()]];
  }));
}
export function wikiLink(value) {
  const match = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/.exec(cleanWiki(value));
  return match ? { title: match[1].replaceAll('_', ' ').trim(), name: (match[2] || match[1]).trim() } : null;
}
export function parseCareer(text) {
  const fields = footballBiography(text);
  if (!fields) return null;
  const career = [], nations = [];
  for (const key of Object.keys(fields)) {
    const club = /^clubs(\d+)$/.exec(key);
    if (club) {
      const link = wikiLink(fields[key]), value = cleanWiki(fields['caps' + club[1]]).replace(/<[^>]*>/g, '').trim();
      // An absent/unknown cap count is not proof of having played. Never turn it into 1.
      if (link && /^\d+$/.test(value)) career.push({ ...link, appearances: Number(value), years: fields['years' + club[1]] || '' });
    }
    const national = /^nationalteam(\d+)$/.exec(key);
    if (national && Number(fields['nationalcaps' + national[1]]) > 0) {
      const link = wikiLink(fields[key]);
      if (link && / national (?:association )?(?:football|soccer) team$/i.test(link.title) && !/under[ -]?\d|U-?\d|youth|Olympic|B team/i.test(link.title)) {
        nations.push(link.title.replace(/ (?:men's )?national (?:association )?(?:football|soccer) team$/i, ''));
      }
    }
  }
  return { name: plain(fields.name || ''), career, nations: [...new Set(nations)], updatedAt: fields['club-update'] || fields['pcupdate'] || null };
}
export function parseCurrentSquad(html) {
  const headings = [...html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const candidates = headings.filter((heading) => /^(?:Current (?:squad|players)|First[- ]team(?: squad)?|Senior squad|Squad|Players)$/i.test(plain(heading[2]))).sort((a, b) => {
    const score = (heading) => /current|first|senior/i.test(plain(heading[2])) ? 0 : /^squad$/i.test(plain(heading[2])) ? 1 : 2;
    return score(a) - score(b);
  });
  for (const heading of candidates) {
    // A subsection such as Out on loan or Reserve squad ends the active roster too.
    const next = headings.find((other) => other.index > heading.index);
    const section = html.slice(heading.index + heading[0].length, next?.index || html.length);
    const players = [];
    for (const row of section.matchAll(/<tr\b[^>]*class="[^"]*(?:vcard|agent)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const countryCodes = [...row[1].matchAll(/<a\b[^>]*>([A-Z]{3})<\/a>/g)].map((match) => match[1]);
      const fn = row[1].match(/<span\b[^>]*class="[^"]*\bfn\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const link = fn?.[1].match(/<a\b[^>]*href="\/wiki\/([^"#]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (link && !link[1].includes(':')) players.push({ title: decodeHtml(decodeURIComponent(link[1])).replaceAll('_', ' '), name: plain(link[2]), countryCodes });
      else if (fn && plain(fn[1])) players.push({ title: null, name: plain(fn[1]), countryCodes });
    }
    if (players.length >= 10) return [...new Map(players.map((player) => [player.title || '#' + player.name, player])).values()];
  }
  return [];
}

export { mergeSeason } from '../src/football-season.js';
