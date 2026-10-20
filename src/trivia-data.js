import football from './data/football.json' with { type: 'json' };
import lol from './data/lol.json' with { type: 'json' };
import { allowedFootballClubIds } from './football-priority.js';
import { shuffled, secureIndex } from './game-rules.js';
import { FLAG_COUNTRIES } from './flag-data.js';

const normalize = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('ı', 'i').replace(/[^a-z0-9]/g, '');
const famousNames = new Set(('Lionel Messi|Cristiano Ronaldo|Kylian Mbappé|Erling Haaland|Mohamed Salah|Kevin De Bruyne|Harry Kane|Robert Lewandowski|Neymar|Luis Suárez|Karim Benzema|Luka Modrić|Toni Kroos|Jude Bellingham|Vinícius Júnior|Rodrygo|Lamine Yamal|Pedri|Gavi|Bukayo Saka|Phil Foden|Cole Palmer|Bruno Fernandes|Bernardo Silva|Heung-min Son|Son Heung-min|Sadio Mané|Victor Osimhen|Mauro Icardi|Edin Džeko|Dušan Tadić|Arda Güler|Kenan Yıldız|Hakan Çalhanoğlu|Orkun Kökçü|Kerem Aktürkoğlu|Barış Alper Yılmaz|Davinson Sánchez|Fernando Muslera|Dries Mertens|Wesley Sneijder|Didier Drogba|Alex de Souza|Gheorghe Hagi|Robin van Persie|Mesut Özil|İlkay Gündoğan|Antonio Rüdiger|Virgil van Dijk|Sergio Ramos|Gerard Piqué|Carles Puyol|Pepe|Raphaël Varane|Thibaut Courtois|Manuel Neuer|Gianluigi Buffon|Iker Casillas|Alisson Becker|Ederson|Emiliano Martínez|Gianluigi Donnarumma|David de Gea|Achraf Hakimi|Trent Alexander-Arnold|Andrew Robertson|Jordi Alba|Marcelo|Dani Alves|Jamal Musiala|Florian Wirtz|Xavi Simons|Federico Valverde|Frenkie de Jong|Declan Rice|Rodri|Nicolò Barella|Joshua Kimmich|Antoine Griezmann|Paulo Dybala|Lautaro Martínez|Julián Álvarez|Ángel Di María|Gonzalo Higuaín|Sergio Agüero|Carlos Tévez|Edinson Cavani|Diego Forlán|Zlatan Ibrahimović|Samuel Eto’o|Samuel Eto\'o|Ronaldinho|Ronaldo|Rivaldo|Kaká|Roberto Carlos|Cafu|David Beckham|Wayne Rooney|Paul Scholes|Ryan Giggs|Steven Gerrard|Frank Lampard|John Terry|Rio Ferdinand|Thierry Henry|Dennis Bergkamp|Patrick Vieira|Eric Cantona|Zinedine Zidane|Luís Figo|Raúl|Fernando Torres|David Villa|Xavi|Andrés Iniesta|Sergio Busquets|Francesco Totti|Alessandro Del Piero|Andrea Pirlo|Paolo Maldini|Alessandro Nesta|Fabio Cannavaro|Clarence Seedorf|Ruud van Nistelrooy|Arjen Robben|Franck Ribéry|Bastian Schweinsteiger|Miroslav Klose|Thomas Müller|Mario Götze|Mats Hummels|Milan Baroš|Moussa Sow|Nani|Ricardo Quaresma|Simao|Simão|Demba Ba|Mario Gómez|Pierre-Emerick Aubameyang|Romelu Lukaku|Eden Hazard|Dele Alli|Dejan Kulusevski|Christian Eriksen|Riyad Mahrez').split('|').map(normalize));
const clubs = football.clubs.filter(club => allowedFootballClubIds.has(club.id));
const countries = football.countries;
const countryMap = new Map(countries.map(country => [country.id, country]));
const clubMap = new Map(clubs.map(club => [club.id, club]));
function question(prompt, correct, distractors, extras = {}) {
  const options = shuffled([correct, ...shuffled(distractors).slice(0, 3)]).map(option => ({ id: crypto.randomUUID(), label: option.name || option.label, ...(option.englishLabel ? { englishLabel: option.englishLabel } : {}) }));
  const answer = options.find(option => option.label === (correct.name || correct.label)).id;
  return { prompt, options, answer, ...extras };
}
function footballPool() {
  const pool = [];
  for (const player of football.players) {
    if (![player.name, ...(player.aliases || [])].some(name => famousNames.has(normalize(name)))) continue;
    if (player.countries.length === 1 && countryMap.has(player.countries[0])) {
      const correct = countryMap.get(player.countries[0]);
      pool.push(() => question(`${player.name} hangi ülkenin futbolcusudur?`, correct, countries.filter(country => !player.countries.includes(country.id))));
    }
    const played = (player.memberships || []).filter(entry => entry.appearances > 0 && clubMap.has(entry.club));
    if (played.length && clubs.filter(club => !player.clubs.includes(club.id)).length >= 3) pool.push(() => {
      const correct = clubMap.get(played[secureIndex(played.length)].club);
      return question(`${player.name}, aşağıdaki kulüplerin hangisinde A takımda forma giydi?`, correct, clubs.filter(club => !player.clubs.includes(club.id)));
    });
  }
  return pool;
}
function lolPool() {
  const attributes = new Map(lol.attributes.map(attribute => [attribute.id, attribute]));
  const pool = [];
  const prompts = { region: 'hangi bölgeyle bağlantılıdır', origin: 'hangi kökene sahiptir', species: 'hangi tür grubunda yer alır', lane: 'hangi koridorda oynanabilir', class: 'hangi sınıfa dahildir' };
  for (const champion of lol.champions) for (const type of ['region','origin','species','lane','class']) {
    const valid = champion.attributes.map(id => attributes.get(id)).filter(attribute => attribute.type === type);
    const wrong = lol.attributes.filter(attribute => attribute.type === type && !champion.attributes.includes(attribute.id));
    if (valid.length && wrong.length >= 3) pool.push(() => question(`${champion.name}, ${prompts[type]}?`, valid[secureIndex(valid.length)], wrong));
  }
  return pool;
}
// Only factories are cached; answer positions and distractors are freshly shuffled per match.
let footballFactories, lolFactories;
export function triviaDeck(category, count) {
  if (category === 'flags') return shuffled(FLAG_COUNTRIES).slice(0, count).map(country => ({ prompt: 'Bu bayrak hangi ülkeye ait?', answer: country.code, answerLabel: country.name, flagCode: country.code }));
  const pool = category === 'football' ? (footballFactories ||= footballPool()) : category === 'lol' ? (lolFactories ||= lolPool()) : [];
  if (pool.length < count) throw new Error('Bu kategoride yeterli soru yok.');
  return shuffled(pool).slice(0, count).map(factory => factory());
}
