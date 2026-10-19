import test from 'node:test';
import assert from 'node:assert/strict';
import { commonsImage, lookupFootballMedia } from '../src/football-media.js';
import worker from '../src/worker.js';
import data from '../src/data/football.json' with { type: 'json' };

const info = (name, license = 'CC BY-SA 4.0') => ({
  mime: 'image/jpeg',
  thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/${name}/120px-${name}`,
  descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}`,
  extmetadata: {
    Artist: { value: '<a href="https://commons.wikimedia.org/wiki/User:Example">Example &amp; Author</a>' },
    LicenseShortName: { value: license },
    LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }
  }
});
const claim = (file) => ({ rank: 'normal', mainsnak: { datavalue: { value: file } } });
const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('Commons metadata yields a thumbnail, source and plain author attribution', () => {
  const media = commonsImage(info('Photo.jpg'));
  assert.equal(new URL(media.src).hostname, 'thumb.wikimedia.org');
  assert.equal(media.author, 'Example & Author');
  assert.equal(media.license, 'CC BY-SA 4.0');
  assert.ok(media.source.startsWith('https://commons.wikimedia.org/wiki/File:'));
});

test('non-free licenses, executable URLs, foreign hosts and missing BY credits are rejected', () => {
  for (const license of ['Fair use', 'CC BY-NC 4.0', 'CC BY-ND 4.0', 'GFDL']) assert.equal(commonsImage(info('Photo.jpg', license)), null);
  assert.equal(commonsImage({ ...info('Photo.jpg'), thumburl: 'https://example.com/track.jpg' }), null);
  assert.equal(commonsImage({ ...info('Photo.jpg'), descriptionurl: 'javascript:alert(1)' }), null);
  const missingAuthor = info('Photo.jpg'); delete missingAuthor.extmetadata.Artist;
  assert.equal(commonsImage(missingAuthor), null);
  const missingLicenseUrl = info('Photo.jpg'); delete missingLicenseUrl.extmetadata.LicenseUrl;
  assert.equal(commonsImage(missingLicenseUrl), null);
});

test('club lookup uses P154, player lookup uses P18 and only metadata is cached', async () => {
  let requests = 0;
  const records = new Map();
  const cache = {
    match: async (key) => records.get(key.url)?.clone(),
    put: async (key, value) => records.set(key.url, value.clone())
  };
  const fetcher = async (url) => {
    requests++;
    if (url.hostname === 'www.wikidata.org') return json({ entities: {
      Q495299: { claims: { P154: [claim('Logo.svg')], P18: [claim('Stadium.jpg')] } },
      Q11571: { claims: { P18: [claim('Portrait.jpg')] } }
    } });
    assert.ok(url.searchParams.get('titles').includes('File:Logo.svg'));
    assert.ok(!url.searchParams.get('titles').includes('Stadium'));
    return json({ query: { pages: {
      1: { title: 'File:Logo.svg', imageinfo: [{ ...info('Logo.svg', 'Public domain'), mime: 'image/svg+xml' }] },
      2: { title: 'File:Portrait.jpg', imageinfo: [info('Portrait.jpg')] }
    } } });
  };
  const options = { cache, fetcher, origin: 'https://example.test' };
  const first = await lookupFootballMedia(['Q495299', 'Q11571'], options);
  assert.ok(first.Q495299.src && first.Q11571.src);
  assert.equal(requests, 2);
  assert.equal(records.size, 2);
  for (const response of records.values()) assert.match(response.headers.get('content-type'), /json/);
  const second = await lookupFootballMedia(['Q495299', 'Q11571'], options);
  assert.deepEqual(second, first);
  assert.equal(requests, 2);
});

test('missing club logo never substitutes a stadium photograph', async () => {
  let requests = 0;
  const items = await lookupFootballMedia(['Q8682'], { fetcher: async () => {
    requests++;
    return json({ entities: { Q8682: { claims: { P18: [claim('Stadium.jpg')] } } } });
  } });
  assert.equal(items.Q8682, null);
  assert.equal(requests, 1);
});

test('temporary Wikimedia failure returns no image without poisoning the metadata cache', async () => {
  let writes = 0;
  const items = await lookupFootballMedia(['Q11571'], {
    fetcher: async () => new Response('', { status: 429 }),
    cache: { match: async () => null, put: async () => { writes++; } }
  });
  assert.equal(items.Q11571, null);
  assert.equal(writes, 0);
});

test('media API rejects unknown IDs and oversized batches before making upstream requests', async () => {
  const unknown = await worker.fetch(new Request('https://example.test/api/football/media?ids=Q1'), {});
  assert.equal(unknown.status, 400);
  const ids = data.clubs.slice(0, 9).map((club) => club.id).join(',');
  const oversized = await worker.fetch(new Request(`https://example.test/api/football/media?ids=${ids}`), {});
  assert.equal(oversized.status, 400);
});
