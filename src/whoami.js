import { shuffled, secureIndex } from './game-rules.js';

// Familiar names only; no biographies or changing popularity rankings are imported.
const celebrities = [
  ['Tarkan'], ['Barış Manço'], ['Cem Karaca'], ['Sezen Aksu'], ['Ajda Pekkan'], ['İbrahim Tatlıses'], ['Müslüm Gürses'], ['Bülent Ersoy'], ['Sertab Erener'], ['Hadise'], ['Sibel Can'], ['Ebru Gündeş'], ['Demet Akalın'], ['Murat Boz'], ['Mustafa Sandal'], ['Kenan Doğulu'], ['Yıldız Tilbe'], ['Gülşen'],
  ['Kemal Sunal'], ['Şener Şen'], ['Cem Yılmaz'], ['Şahan Gökbakar'], ['Ata Demirer'], ['Beyazıt Öztürk', 'Beyaz'], ['Acun Ilıcalı'], ['Haluk Levent'], ['Tarık Akan'], ['Adile Naşit'], ['Münir Özkul'], ['Türkan Şoray'], ['Hülya Avşar'], ['Kıvanç Tatlıtuğ'], ['Kenan İmirzalıoğlu'], ['Burak Özçivit'], ['Hande Erçel'], ['Serenay Sarıkaya'], ['Demet Özdemir'], ['Meryem Uzerli'], ['Beren Saat'], ['Halit Ergenç'],
  ['Lionel Messi', 'Messi', 'Leo Messi'], ['Cristiano Ronaldo', 'Ronaldo', 'CR7'], ['Neymar', 'Neymar Jr'], ['Kylian Mbappé', 'Mbappe'], ['Erling Haaland', 'Haaland'], ['Ronaldinho'], ['David Beckham', 'Beckham'], ['Arda Güler'], ['Arda Turan'], ['Hakan Şükür'], ['Fatih Terim'], ['Alex de Souza', 'Alex'], ['Didier Drogba', 'Drogba'], ['Michael Jordan', 'Jordan'], ['LeBron James', 'Lebron'], ['Kobe Bryant', 'Kobe'], ['Muhammed Ali', 'Muhammad Ali'], ['Mike Tyson', 'Tyson'], ['Usain Bolt', 'Bolt'], ['Serena Williams'],
  ['Michael Jackson'], ['Madonna'], ['Beyoncé', 'Beyonce'], ['Taylor Swift'], ['Shakira'], ['Rihanna'], ['Adele'], ['Eminem'], ['Justin Bieber'], ['Bruno Mars'], ['Billie Eilish'], ['Elvis Presley', 'Elvis'], ['Bob Marley'], ['Freddie Mercury'],
  ['Leonardo DiCaprio', 'DiCaprio'], ['Brad Pitt'], ['Tom Cruise'], ['Johnny Depp'], ['Will Smith'], ['Keanu Reeves'], ['Dwayne Johnson', 'The Rock'], ['Jackie Chan'], ['Bruce Lee'], ['Charlie Chaplin', 'Şarlo'], ['Marilyn Monroe'], ['Angelina Jolie'], ['Scarlett Johansson'], ['Jennifer Lopez', 'J Lo', 'JLo'], ['Robert Downey Jr.', 'Robert Downey Jr', 'Robert Downey'], ['Morgan Freeman'], ['Rowan Atkinson', 'Mr Bean', 'Mr. Bean'], ['Jim Carrey'], ['Arnold Schwarzenegger', 'Schwarzenegger'], ['Sylvester Stallone', 'Stallone'],
  ['Albert Einstein', 'Einstein'], ['Nikola Tesla', 'Tesla'], ['Isaac Newton', 'Newton'], ['Stephen Hawking', 'Hawking'], ['Mustafa Kemal Atatürk', 'Atatürk', 'Mustafa Kemal'], ['Steve Jobs'], ['Elon Musk'], ['Bill Gates'], ['Mark Zuckerberg', 'Zuckerberg']
];
const jobs = [
  ['Doktor', 'Hekim'], ['Öğretmen'], ['Polis'], ['İtfaiyeci'], ['Hemşire'], ['Diş Hekimi', 'Dişçi'], ['Veteriner', 'Veteriner Hekim'], ['Eczacı'], ['Avukat'], ['Hakim', 'Hâkim', 'Yargıç'], ['Savcı'], ['Asker'], ['Pilot'], ['Kabin Memuru', 'Hostes', 'Host'], ['Kaptan', 'Gemi Kaptanı'], ['Şoför', 'Sürücü'], ['Taksici', 'Taksi Şoförü'], ['Kurye'], ['Postacı'], ['Aşçı', 'Şef'], ['Garson'], ['Fırıncı'], ['Kasap'], ['Manav'], ['Çiftçi'], ['Balıkçı'], ['Berber'], ['Kuaför'], ['Terzi'], ['Marangoz'], ['Tesisatçı', 'Su Tesisatçısı'], ['Elektrikçi'], ['Tamirci', 'Oto Tamircisi'], ['İnşaat İşçisi'], ['Mimar'], ['Mühendis'], ['Yazılımcı', 'Programcı', 'Yazılım Geliştirici'], ['Muhasebeci'], ['Bankacı'], ['Kasiyer'], ['Güvenlik Görevlisi', 'Güvenlikçi'], ['Temizlik Görevlisi', 'Temizlikçi'], ['Çöpçü'], ['Madenci'], ['Astronot'], ['Bilim İnsanı', 'Bilim Adamı', 'Bilim Kadını'], ['Oyuncu', 'Aktör', 'Aktris'], ['Şarkıcı'], ['Müzisyen'], ['Dansçı'], ['Ressam'], ['Heykeltıraş'], ['Fotoğrafçı'], ['Gazeteci', 'Muhabir'], ['Sunucu', 'Spiker'], ['Yazar'], ['Şair'], ['Yönetmen'], ['Futbolcu'], ['Basketbolcu'], ['Hakem'], ['Antrenör', 'Teknik Direktör'], ['Psikolog'], ['Diyetisyen'], ['Fizyoterapist'], ['Kütüphaneci'], ['Çevirmen', 'Tercüman'], ['Tur Rehberi', 'Turist Rehberi'], ['Emlakçı'], ['Çilingir'], ['Çiçekçi'], ['Bakkal']
];
export const WHO_CATEGORIES = { 'Ünlüler': celebrities, 'Meslekler': jobs, 'Karışık': [...celebrities, ...jobs] };
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replace(/[^\p{L}\p{N}]/gu, '');
export function createWhoami(members, category = 'Ünlüler', round = 1, random = secureIndex) {
  if (members.length < 2 || members.length > 8) throw new Error('Kimim Ben? için 2–8 oyuncu gerekli.');
  if (typeof category !== 'string' || !Object.hasOwn(WHO_CATEGORIES, category)) category = 'Ünlüler';
  const cards = shuffled(WHO_CATEGORIES[category], random).slice(0, members.length);
  const participants = members.map((member) => member.id);
  return { kind: 'whoami', gameId: crypto.randomUUID(), phase: 'playing', round, category, participants,
    names: Object.fromEntries(members.map((member) => [member.id, member.nickname])),
    identities: Object.fromEntries(participants.map((id, i) => [id, { name: cards[i][0], aliases: cards[i] }])),
    solved: [], turn: participants[random(participants.length)], turnId: crypto.randomUUID() };
}
export function whoamiView(game) {
  return { kind: game.kind, gameId: game.gameId, phase: game.phase, round: game.round, category: game.category,
    participants: game.participants, names: game.names, solved: game.solved, turn: game.turn, turnId: game.turnId };
}
export function whoamiCards(game, viewer) {
  return game.participants.map((id) => ({ id, name: game.names[id], solved: game.solved.includes(id),
    identity: id === viewer && game.phase === 'playing' && !game.solved.includes(id) ? null : game.identities[id].name }));
}
export function advanceWhoami(game, connected) {
  if (game.participants.every((id) => game.solved.includes(id))) { game.phase = 'results'; game.turn = null; game.turnId = null; return; }
  const start = game.participants.indexOf(game.turn);
  for (let step = 1; step <= game.participants.length; step++) {
    const id = game.participants[(start + step) % game.participants.length];
    if (!game.solved.includes(id) && connected.has(id)) { game.turn = id; game.turnId = crypto.randomUUID(); return; }
  }
  // No connected unsolved player: keep the round recoverable after reconnect.
  game.turn = game.participants.find((id) => !game.solved.includes(id)); game.turnId = crypto.randomUUID();
}
export function guessWhoami(game, playerId, value, connected) {
  if (game.phase !== 'playing' || game.turn !== playerId || game.solved.includes(playerId)) throw new Error('Tahmin sırası sende değil.');
  const guess = String(value || '').trim().slice(0, 80);
  if (!normalize(guess)) throw new Error('Bir tahmin yaz.');
  const correct = game.identities[playerId].aliases.some((alias) => normalize(alias) === normalize(guess));
  if (correct) game.solved.push(playerId);
  advanceWhoami(game, connected);
  return correct;
}
