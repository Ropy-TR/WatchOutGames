const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
// Internal binding only. Passwords, player identities and game secrets never enter this store.
export class LobbyDirectory {
  constructor(state) { this.storage = state.storage; this.queue = Promise.resolve(); }
  fetch(request) {
    const task = this.queue.then(async () => {
      const now = Date.now();
      let rooms = (await this.storage.get('rooms') || []).filter(room => room.expiresAt > now);
      if (request.method === 'POST') {
        const body = await request.json();
        if (!/^[A-Z0-9]{5}$/.test(body.code || '')) return new Response('Invalid code', { status: 400 });
        rooms = rooms.filter(room => room.code !== body.code);
        if (body.playerCount > 0 && body.visible === true) rooms.push({ code: body.code, playerCount: Math.min(8, body.playerCount), full: body.full === true, game: String(body.game || '').slice(0, 24), expiresAt: now + 90000 });
        rooms = rooms.slice(-100);
      }
      await this.storage.put('rooms', rooms);
      return json({ rooms: rooms.map(({ expiresAt, ...room }) => room) });
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
