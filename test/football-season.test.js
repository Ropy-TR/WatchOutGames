import test from 'node:test';
import assert from 'node:assert/strict';
import { footballBiography, parseCareer, parseCurrentSquad } from '../scripts/football-season-import.mjs';
import { mergeSeason } from '../src/football-season.js';

test('Football biography separates senior careers, youth teams, nested links and references', () => {
  const wiki = `{{Infobox football biography
|name=Test Player
|birth_date={{birth date|2000|1|2}}
|youthclubs1=[[Chelsea F.C.]]
|clubs1=[[AFC Ajax|Ajax]]
|caps1=12<ref>old source | text</ref>
|clubs2=[[Galatasaray S.K. (football)|Galatasaray]]
|caps2=0
|clubs3=[[FC Porto|Porto]]
|caps3=
|nationalteam1=[[Sweden national under-21 football team|Sweden U21]]
|nationalcaps1=5
|nationalteam2=[[Turkey national football team|Turkey]]
|nationalcaps2=3
}}`;
  assert.ok(footballBiography(wiki).birth_date.includes('2000'));
  const parsed = parseCareer(wiki);
  assert.deepEqual(parsed.career.map((c) => [c.title,c.appearances]), [['AFC Ajax',12],['Galatasaray S.K. (football)',0]]);
  assert.deepEqual(parsed.nations, ['Turkey']);
});
test('Malformed football biography is rejected without executing wiki content', () => {
  assert.throws(() => footballBiography('{{Infobox football biography|name={{broken}}'));
  assert.equal(footballBiography('{{Infobox person|name=X}}'), null);
});
test('US soccer-biography alias and senior soccer nationality are supported', () => {
  const parsed = parseCareer("{{Infobox soccer biography|name=US Player|clubs1=[[AC Milan]]|caps1=5|nationalteam1=[[United States men's national soccer team|United States]]|nationalcaps1=10}}");
  assert.equal(parsed.career[0].title,'AC Milan');
  assert.deepEqual(parsed.nations,['United States']);
});
test('Current roster excludes out-on-loan and academy sections even under Players heading', () => {
  const row = (name, link = true) => `<tr class="vcard agent"><td><span class="fn">${link ? `<a href="/wiki/${name}">${name}</a>` : name}</span></td></tr>`;
  const html = '<h2>Players</h2><h3>Current squad</h3>' + Array.from({length:11}, (_,i) => row('Player_'+i,i!==10)).join('') + '<h3>Out on loan</h3>' + row('Loaned_Player') + '<h3>Academy players</h3>' + row('Youth_Player');
  const roster = parseCurrentSquad(html);
  assert.equal(roster.length,11); assert.equal(roster.at(-1).title,null);
  assert.ok(!roster.some((p) => p.title === 'Loaned Player' || p.title === 'Youth Player'));
  const parentHeading = html.replace('<h2>Players</h2><h3>Current squad</h3>', '<h2>Current squad</h2>');
  assert.equal(parseCurrentSquad(parentHeading).length,11);
  const withFlag = html.replace('Player_0</a>', 'Player_0</a>').replace('<span class="fn">', '<a href="/wiki/French_Football_Federation">FRA</a><span class="fn">');
  assert.deepEqual(parseCurrentSquad(withFlag)[0].countryCodes,['FRA']);
});
test('Registration qualifies a zero-cap new transfer without inventing an appearance', () => {
  const base = {players:[{id:'Q1',name:'Player',aliases:[],clubs:['Q10'],countries:['Q30'],memberships:[{club:'Q10',appearances:5}]}],countries:[{id:'Q30',name:'Country'}]};
  const season = {fetchedAt:'2026-10-20T00:00:00Z',countries:[],players:[{id:'Q1',name:'Player',aliases:[],title:'Player',revision:123,countries:[],career:[{club:'Q20',appearances:0}],currentSquads:[{club:'Q20',title:'Club',revision:456}]}]};
  const player = mergeSeason(base,season).players[0];
  assert.deepEqual(player.clubs,['Q10','Q20']);
  assert.equal(player.memberships.find((m) => m.club === 'Q20').appearances,0);
  assert.equal(player.memberships.find((m) => m.club === 'Q20').source,'current-squad');
  assert.deepEqual(base.players[0].clubs,['Q10']);
});
test('Historical zero caps remove stale answers; unknown registered caps remain null', () => {
  const base = {players:[{id:'Q1',name:'X',aliases:[],clubs:['Q10'],countries:[],memberships:[{club:'Q10',appearances:8}]}],countries:[]};
  const season = {fetchedAt:'now',countries:[],players:[{id:'Q1',name:'X',aliases:[],title:'X',revision:1,countries:['Q43'],career:[{club:'Q10',appearances:0}],currentSquads:[{club:'Q20',title:'Club',revision:2}]}]};
  const player = mergeSeason(base,season).players[0];
  assert.deepEqual(player.clubs,['Q20']); assert.deepEqual(player.countries,['Q43']);
  assert.equal(player.memberships[0].appearances,null);
});
