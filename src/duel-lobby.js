export function duelSeats(members, initiator) {
  return { players: [initiator, members.find(member => member.id !== initiator)?.id || null], names: Object.fromEntries(members.map(member => [member.id, member.nickname])) };
}
export function claimDuelSeat(game, id, side, connected, members) {
  if (game.phase !== 'lobby' || ![-1, 0, 1].includes(side)) throw new Error('Taraf seçimi yalnızca hazırlıkta yapılabilir.');
  if (side >= 0 && game.players[side] && game.players[side] !== id && connected.has(game.players[side])) throw new Error('Bu taraf dolu.');
  game.players = game.players.map(player => player === id ? null : player);
  if (side >= 0) game.players[side] = id;
  game.names = Object.fromEntries(members.map(member => [member.id, member.nickname]));
}
export function requireDuelPlayers(game, id, connected) {
  if (game.phase !== 'lobby' || !game.players.includes(id)) throw new Error('Önce bir taraf seç.');
  if (new Set(game.players).size !== 2 || !game.players.every(player => player && connected.has(player))) throw new Error('İki oyuncu da bağlı olmalı.');
}
