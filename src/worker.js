export { Room } from './room.js';
import { SPY_CATEGORIES } from './game-data.js';
import { footballCatalog, searchFootballPlayers, footballMediaKind } from './football.js';
import { lookupFootballMedia } from './football-media.js';
const footballCatalogBody = JSON.stringify(footballCatalog());

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }
});

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/api/games' && request.method === 'GET') return json({ spyCategories: Object.keys(SPY_CATEGORIES) });
    if (url.pathname === '/api/football/media' && request.method === 'GET') {
      const ids = [...new Set((url.searchParams.get('ids') || '').split(',').filter(Boolean))];
      if (!ids.length || ids.length > 8 || ids.some((id) => !footballMediaKind(id))) return json({ error: 'Geçersiz görsel isteği.' }, 400);
      const items = await lookupFootballMedia(ids, {
        origin: url.origin,
        cache: typeof caches === 'undefined' ? null : caches.default,
        waitUntil: context ? (promise) => context.waitUntil(promise) : null
      });
      const response = json({ items });
      response.headers.set('cache-control', 'public, max-age=300');
      return response;
    }
    if (url.pathname === '/api/football/search' && request.method === 'GET') {
      const response = json({ players: searchFootballPlayers(url.searchParams.get('q')) });
      response.headers.set('cache-control', 'public, max-age=300');
      return response;
    }
    if (url.pathname === '/api/football' && request.method === 'GET') {
      return new Response(footballCatalogBody, { headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'access-control-allow-origin': '*'
      } });
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const roomCode = code();
      const id = env.ROOMS.idFromName(roomCode);
      const room = env.ROOMS.get(id);
      const body = await request.json();
      const result = await room.fetch("https://room/init", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
      });
      if (!result.ok) return result;
      return json({ code: roomCode });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})(?:\/socket)?$/i);
    if (match) {
      const id = env.ROOMS.idFromName(match[1].toUpperCase());
      return env.ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

