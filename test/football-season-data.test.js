import test from 'node:test';
import assert from 'node:assert/strict';
import season from '../src/data/football-season.json' with { type: 'json' };
import data from '../src/football-dataset.js';
import { footballCatalog, cellCandidates, validateFootballPick, searchFootballPlayers, footballMediaKind } from '../src/football.js';
import priority from '../src/data/football-priority.json' with { type: 'json' };

test('Every selected club has a complete imported active-squad list with source revision', () => {
  const ids = new Set(Object.values(priority.leagues).flat().map((club) => club.id));
  assert.equal(season.squadCoverage.length, ids.size);
  for (const squad of season.squadCoverage) {
    assert.ok(ids.has(squad.club)); assert.ok(squad.revision > 0);
    assert.ok(squad.squadSize >= 10); assert.equal(squad.importedPlayers,squad.squadSize);
  }
  assert.ok(season.players.length > 1500);
  assert.equal(footballCatalog().squadCount,65);
  assert.equal(footballCatalog().seasonCheckedAt,season.fetchedAt);
});
test('Reported missing players now validate against current and previous clubs', () => {
  const cases = [
    {id:'Q20737387',query:'davinson sanchez',clubs:['Q495299','Q81888','Q18741']},
    {id:'Q97725322',query:'kerem akturkoglu',clubs:['Q495299','Q6601875','Q131499']},
    {id:'Q110211916',query:'bitshiabu',clubs:['Q495299','Q702455','Q483020']},
    {id:'Q123174990',query:'deniz gul',clubs:['Q495299','Q128446']}
  ];
  for (const entry of cases) {
    const player = data.players.find((p) => p.id === entry.id); assert.ok(player);
    for (const club of entry.clubs) assert.ok(player.clubs.includes(club),entry.query+' '+club);
    assert.ok(searchFootballPlayers(entry.query).some((p) => p.id === entry.id));
    const game = {mode:'clubs',topIds:[entry.clubs[0]],sideIds:[entry.clubs[1]],picks:{},playerPicks:{},boardId:'test',dataVersion:footballCatalog().version};
    assert.ok(cellCandidates(game,0,0).includes(entry.id));
    assert.equal(validateFootballPick(game,{boardId:'test',key:'0-0',playerId:entry.id}).id,entry.id);
  }
});
test('Squad-only transfer is accepted without a fabricated positive cap count', () => {
  const player = data.players.find((p) => p.id === 'Q110211916');
  const membership = player.memberships.find((m) => m.club === 'Q495299');
  assert.ok(membership.currentSquad); assert.ok(membership.currentSquad.revision > 0);
  assert.equal(data.players.find((p) => p.id === 'Q123174990').countries.includes('Q43'),true);
  assert.equal(data.players.find((p) => p.id === 'Q123174990').countries.includes('Q34'),false);
});
test('Fallback squad identities remain searchable but never become fake Wikidata media IDs', () => {
  for (const player of season.players.filter((p) => !/^Q\d+$/.test(p.id))) {
    assert.ok(data.players.some((p) => p.id === player.id));
    assert.equal(footballMediaKind(player.id),null);
    assert.ok(player.currentSquads.length);
  }
});
