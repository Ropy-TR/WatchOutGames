import { readFile, access } from 'node:fs/promises';
import { RELEASE } from '../src/release.js';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/index.html', root), 'utf8');
if (!html.includes(`data-release="${RELEASE}"`) || !html.includes('data-game="lol"') || !html.includes(`/app.js?v=${RELEASE}`)) throw new Error('Eksik veya eski public/index.html. Güncel paketin tamamını yükleyin.');
for (const file of ['public/app.js', 'public/style.css', 'src/lol.js', 'src/data/lol.json', 'src/data/football.json', 'src/data/football-priority.json']) await access(new URL(file, root));
const app = await readFile(new URL('public/app.js', root), 'utf8');
if (!app.includes('start-lol-xox')) throw new Error('public/app.js LoL sürümü değil.');
console.log(`WatchOut Games ${RELEASE}: beş oyun ve veri dosyaları hazır.`);
