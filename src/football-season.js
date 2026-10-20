export function mergeSeason(base, supplement) {
  const players = new Map(base.players.map((p) => [p.id, structuredClone(p)]));
  for (const entry of supplement.players) {
    const player = players.get(entry.id) || { id: entry.id, name: entry.name, aliases: [], clubs: [], countries: [], memberships: [] };
    player.aliases = [...new Set([...player.aliases, entry.name, ...entry.aliases].filter((name) => name && name !== player.name))];
    const verified = new Set(entry.career.map((membership) => membership.club));
    player.memberships = player.memberships.filter((membership) => !verified.has(membership.club));
    player.memberships.push(...entry.career.filter((membership) => membership.appearances > 0).map((m) => ({ club: m.club, appearances: m.appearances, source: 'wikipedia', revision: entry.revision })));
    for (const registration of entry.currentSquads || []) {
      const existing = player.memberships.find((membership) => membership.club === registration.club);
      if (existing) existing.currentSquad = registration;
      else player.memberships.push({ club: registration.club, appearances: entry.career.find((m) => m.club === registration.club)?.appearances ?? null, source: 'current-squad', currentSquad: registration });
    }
    player.clubs = [...new Set(player.memberships.map((membership) => membership.club))].sort();
    if (entry.countries.length) player.countries = entry.countries;
    player.seasonSource = { title: entry.title, revision: entry.revision, checkedAt: supplement.fetchedAt };
    if (player.clubs.length) players.set(player.id, player);
  }
  const countryMap = new Map(base.countries.map((country) => [country.id, country]));
  for (const country of supplement.countries) if (!countryMap.has(country.id)) countryMap.set(country.id, country);
  return { ...base, players: [...players.values()], countries: [...countryMap.values()] };
}
