// Parse data as text, never execute Lua or wiki templates from remote sources.
export function parseChampionLua(text) {
  const matches = [...text.matchAll(/^  \["([^"\n]+)"\] = \{/gm)];
  const entries = matches.map((match, i) => {
    const body = text.slice(match.index, matches[i + 1]?.index || text.length);
    const string = (key) => body.match(new RegExp('\\["' + key + '"\\]\\s*=\\s*"([^"\\n]*)"'))?.[1];
    const list = (key) => [...(body.match(new RegExp('\\["' + key + '"\\]\\s*=\\s*\\{([^}]*)\\}'))?.[1] || '').matchAll(/"([^"\n]+)"/g)].map((m) => m[1]);
    return { name: match[1], id: Number(body.match(/\["id"\]\s*=\s*([\d.]+)/)?.[1]), key: string('apiname'), positions: [...new Set([...list('client_positions'), ...list('external_positions')])], roles: list('role'), classes: [string('herotype'), string('alttype')].filter(Boolean), resource: string('resource') };
  });
  return new Map(entries.filter((entry) => Number.isInteger(entry.id) && entry.key).map((entry) => [String(entry.id), entry]));
}

function splitTemplate(body) {
  const parts = []; let start = 0, templates = 0, links = 0;
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);
    if (pair === '{{') { templates++; i++; }
    else if (pair === '}}') { templates--; i++; }
    else if (pair === '[[') { links++; i++; }
    else if (pair === ']]') { links--; i++; }
    else if (body[i] === '|' && !templates && !links) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start)); return parts;
}
export function championBio(text) {
  const match = /\{\{Champion bio\s*\|/i.exec(text);
  if (!match) throw new Error('Missing Champion bio template');
  let depth = 1, end = match.index + 2;
  for (; end < text.length - 1; end++) {
    const pair = text.slice(end, end + 2);
    if (pair === '{{') { depth++; end++; }
    else if (pair === '}}') { depth--; if (!depth) break; end++; }
  }
  if (depth) throw new Error('Unclosed Champion bio template');
  return Object.fromEntries(splitTemplate(text.slice(match.index + 2, end)).flatMap((part) => {
    const equal = part.indexOf('='); return equal < 0 ? [] : [[part.slice(0, equal).trim(), part.slice(equal + 1).trim()]];
  }));
}
export const currentWikiText = (text) => String(text || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(s|del|ref|small)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<ref\b[^>]*\/>/gi, '');
export function wikiLinks(text) {
  return [...currentWikiText(text).matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((match) => match[1].replace(/^Universe:/i, '').replaceAll('_', ' ').trim());
}
export function wikiRegions(text) {
  const current = currentWikiText(text);
  return [...new Set([...current.matchAll(/\{\{fi\s*\|([^|}]+)/gi)].map((match) => match[1].trim()).concat(wikiLinks(current)))];
}

export const REGION_LABELS = {
  'Bandle City': 'Bandle Şehri', Bilgewater: 'Bilgewater', Demacia: 'Demacia', Freljord: 'Freljord', Ionia: 'Ionia', Ixtal: 'Ixtal', Noxus: 'Noxus', Piltover: 'Piltover', 'Shadow Isles': 'Gölge Adalar', Shurima: 'Shurima', Targon: 'Targon', 'Mount Targon': 'Targon', Void: 'Hiçlik', 'The Void': 'Hiçlik', Zaun: 'Zaun', Runeterra: 'Runeterra', Camavor: 'Camavor', 'Blessed Isles': 'Kutlu Adalar', Icathia: 'Icathia', Kathkan: 'Kathkan', 'Spirit Realm': 'Ruhlar Âlemi', 'Celestial Realm': 'Göksel Âlem'
};
const speciesAliases = {
  Human: 'Human', Yordle: 'Yordle', Vastaya: 'Vastaya', Vesani: 'Vastaya', Bryni: 'Vastaya', Shimon: 'Vastaya', Marai: 'Vastaya', 'Oovi-Kat': 'Vastaya', Kiilash: 'Vastaya', Lhotlan: 'Vastaya',
  Darkin: 'Darkin', Ascended: 'Ascended', 'God-Warrior': 'Ascended', Baccai: 'Ascended', 'Aspect Host': 'Aspect Host', Voidborn: 'Voidborn', "Xer'Sai": 'Voidborn',
  'Spirit God': 'Spirit', Spirit: 'Spirit', 'Spirit Tree': 'Spirit', Celestial: 'Celestial', 'Celestial Dragon': 'Celestial', 'Terrestrial Dragon': 'Dragon', Dragon: 'Dragon',
  Golem: 'Golem', Wraith: 'Undead', Revenant: 'Undead', Undead: 'Undead', Demon: 'Demon', Yeti: 'Yeti', Cat: 'Cat', Dog: 'Dog', Minotaur: 'Minotaur', Brackern: 'Brackern', Troll: 'Troll', 'Fae Fawn': 'Fae Fawn', Treant: 'Treant', 'Plague Rat': 'Plague Rat'
};
export const SPECIES_LABELS = { Human: 'İnsan', Yordle: 'Yordle', Vastaya: 'Vastaya', Darkin: 'Darkin', Ascended: 'Yükselmiş', 'Aspect Host': 'Suret Taşıyıcısı', Voidborn: 'Hiçlik Yaratığı', Spirit: 'Ruh', Celestial: 'Göksel', Dragon: 'Ejderha', Golem: 'Golem', Undead: 'Ölümsüz ruh', Demon: 'İblis', Yeti: 'Yeti', Cat: 'Kedi', Dog: 'Köpek', Minotaur: 'Minotor', Brackern: 'Brackern', Troll: 'Trol', 'Fae Fawn': 'Peri geyiği', Treant: 'Ağaç ruhu', 'Plague Rat': 'Veba faresi', Unknown: 'Türü bilinmiyor', 'Chemical Beast': 'Kimyasal yaratık', 'Evolved Being': 'Evrimleşmiş varlık' };
export function wikiSpecies(raw) {
  const text = currentWikiText(raw);
  const species = wikiLinks(text).map((name) => speciesAliases[name]).filter(Boolean);
  if (/Celestial Dragon/.test(text)) species.push('Dragon');
  if (/^\s*Unknown\b/i.test(text)) species.push('Unknown');
  if (/Chemical beast/i.test(text)) species.push('Chemical Beast');
  if (/Evolved/.test(text)) species.push('Evolved Being');
  return [...new Set(species)];
}
export const LANE_LABELS = { Top: 'Üst koridor', Jungle: 'Orman', Middle: 'Orta koridor', Bottom: 'Alt koridor', Support: 'Destek' };
export const CLASS_LABELS = { Fighter: 'Dövüşçü', Tank: 'Tank', Mage: 'Büyücü', Assassin: 'Suikastçı', Marksman: 'Nişancı', Support: 'Destek sınıfı' };
export const slug = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildLolSnapshot({ riot, lua, pages, redirects = [], fetchedAt, sources }) {
  const records = parseChampionLua(lua);
  const pageMap = new Map(pages.map((page) => [page.title, page]));
  const redirectMap = new Map(redirects.map(({ from, to }) => [from, to]));
  const definitions = new Map();
  const attribute = (type, key, label, englishLabel = key) => {
    const id = type + ':' + slug(key);
    definitions.set(id, { id, type, label, englishLabel }); return id;
  };
  const champions = Object.values(riot.data).map((champion) => {
    const entry = records.get(champion.key);
    if (!entry || !entry.positions.length) throw new Error('Wiki positions missing: ' + champion.id);
    const titles = champion.id === 'Nunu' ? ['Universe:Nunu', 'Universe:Willump'] : ['Universe:' + entry.name];
    const bios = titles.map((initial) => {
      let title = initial; const seen = new Set();
      while (redirectMap.has(title) && !seen.has(title)) { seen.add(title); title = redirectMap.get(title); }
      const page = pageMap.get(title), revision = page?.revisions?.[0];
      if (!revision?.slots.main.content) throw new Error('Wiki biography missing: ' + title);
      const bio = championBio(revision.slots.main.content);
      if (!bio.species || !bio.region) throw new Error('Wiki species/region missing: ' + title);
      return { bio, source: { title, revision: revision.revid, timestamp: revision.timestamp, url: 'https://wiki.leagueoflegends.com/en-us/' + encodeURIComponent(title).replaceAll('%3A', ':') } };
    });
    const regions = [...new Set(bios.flatMap(({ bio }) => wikiRegions(bio.region)).filter((name) => REGION_LABELS[name]))];
    const origins = [...new Set(bios.flatMap(({ bio }) => wikiLinks(bio.originplace)).filter((name) => REGION_LABELS[name]))];
    const species = [...new Set(bios.flatMap(({ bio }) => wikiSpecies(bio.species)))];
    if (!regions.length || !species.length) throw new Error('Unmapped wiki fields: ' + champion.id);
    const attributes = [
      ...regions.map((name) => attribute('region', REGION_LABELS[name], REGION_LABELS[name], name === 'The Void' ? 'Void' : name === 'Mount Targon' ? 'Targon' : name)),
      ...origins.map((name) => attribute('origin', REGION_LABELS[name], REGION_LABELS[name], name === 'The Void' ? 'Void' : name === 'Mount Targon' ? 'Targon' : name)),
      ...species.map((name) => attribute('species', name, SPECIES_LABELS[name])),
      ...entry.positions.map((lane) => { if (!LANE_LABELS[lane]) throw new Error('Unknown lane ' + lane); return attribute('lane', lane, LANE_LABELS[lane]); }),
      ...champion.tags.map((name) => { if (!CLASS_LABELS[name]) throw new Error('Unknown class ' + name); return attribute('class', name, CLASS_LABELS[name]); })
    ];
    return { id: champion.key, key: champion.id, name: champion.name, aliases: [...new Set([entry.name, champion.id])], icon: `https://ddragon.leagueoflegends.com/cdn/${riot.version}/img/champion/${champion.image.full}`, attributes: [...new Set(attributes)], sources: bios.map(({ source }) => source) };
  });
  const ids = new Set(champions.map((champion) => champion.id));
  if (ids.size !== Object.keys(riot.data).length || champions.length < 170) throw new Error('Incomplete or duplicate champion roster');
  return { schema: 1, patch: riot.version, rosterCount: Object.keys(riot.data).length, fetchedAt, sources, attributes: [...definitions.values()], champions };
}
