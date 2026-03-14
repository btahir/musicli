import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findSavedChannel,
  findLocalFolder,
  normalizeChannelSlug,
  parseSavedChannelInput,
  upsertLocalFolder,
  upsertRecentStream,
  upsertSavedChannel,
  type LocalFolderSource,
  type SavedChannel,
} from '../src/library/channels.js';

test('normalizeChannelSlug creates a stable short alias', () => {
  assert.equal(normalizeChannelSlug('Lofi Girl Live'), 'lofi-girl-live');
  assert.equal(normalizeChannelSlug('  Cafe / Rain  '), 'cafe-rain');
});

test('parseSavedChannelInput recognizes name equals url syntax', () => {
  assert.deepEqual(
    parseSavedChannelInput('lofi girl = https://www.youtube.com/watch?v=jfKfPfyJRdk'),
    {
      label: 'lofi girl',
      url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    },
  );
  assert.equal(parseSavedChannelInput('https://example.com/stream.m3u8'), null);
  assert.equal(parseSavedChannelInput('https://www.youtube.com/watch?v=jfKfPfyJRdk'), null);
});

test('upsertSavedChannel inserts and updates saved channels by slug', () => {
  const created = upsertSavedChannel([], 'lofi girl', 'https://example.com/one');
  assert.equal(created.channel.slug, 'lofi-girl');
  assert.equal(created.channels.length, 1);

  const updated = upsertSavedChannel(created.channels, 'lofi girl', 'https://example.com/two', '2026-03-13T00:00:00.000Z');
  assert.equal(updated.channels.length, 1);
  assert.equal(updated.channel.url, 'https://example.com/two');
});

test('findSavedChannel resolves either by slug or label', () => {
  const channels: SavedChannel[] = [
    {
      slug: 'lofi-girl',
      label: 'Lofi Girl',
      url: 'https://example.com/stream',
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
    },
  ];

  assert.equal(findSavedChannel(channels, 'lofi-girl')?.slug, 'lofi-girl');
  assert.equal(findSavedChannel(channels, 'Lofi Girl')?.slug, 'lofi-girl');
});

test('upsertRecentStream keeps the newest stream at the front and deduplicates by input', () => {
  const first = upsertRecentStream([], 'https://example.com/one', 'One', '2026-03-13T00:00:00.000Z');
  const second = upsertRecentStream(first, 'https://example.com/two', 'Two', '2026-03-13T01:00:00.000Z');
  const third = upsertRecentStream(second, 'https://example.com/one', 'One Again', '2026-03-13T02:00:00.000Z');

  assert.deepEqual(third.map((entry) => entry.input), [
    'https://example.com/one',
    'https://example.com/two',
  ]);
  assert.equal(third[0]?.label, 'One Again');
});

test('upsertLocalFolder inserts and finds folders by slug or path', () => {
  const created = upsertLocalFolder([], 'Bedroom Crates', '/Users/example/Music/Lofi');
  assert.equal(created.folder.slug, 'bedroom-crates');

  const folders: LocalFolderSource[] = created.localFolders;
  assert.equal(findLocalFolder(folders, 'bedroom-crates')?.path, '/Users/example/Music/Lofi');
  assert.equal(findLocalFolder(folders, '/Users/example/Music/Lofi')?.slug, 'bedroom-crates');
});
