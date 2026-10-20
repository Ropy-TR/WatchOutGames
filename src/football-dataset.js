import archive from './data/football.json' with { type: 'json' };
import season from './data/football-season.json' with { type: 'json' };
import { mergeSeason } from './football-season.js';

const dataset = mergeSeason(archive, season);
dataset.datasetId = archive.datasetId + ':' + season.datasetId;
dataset.seasonCheckedAt = season.fetchedAt;
dataset.squadCount = season.squadCoverage.length;
dataset.seasonPlayers = season.players.length;
dataset.season = season.season;
dataset.source = 'https://www.wikidata.org/';
dataset.sources = [
  { url: 'https://www.wikidata.org/', license: 'CC0-1.0' },
  { url: 'https://en.wikipedia.org/', license: 'CC-BY-SA-4.0' }
];
dataset.license = 'CC0-1.0 (archive); CC-BY-SA-4.0 (season supplement)';
export default dataset;
