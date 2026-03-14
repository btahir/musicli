import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTrackSearchScopes, searchTracks } from '../src/library/search.js';
import type { RuntimeTrack } from '../src/library/types.js';

const tracks: RuntimeTrack[] = [
  {
    title: 'Electric Puddles',
    slug: 'electric-puddles',
    category: 'late-night',
    categoryLabel: 'Late Night',
    file: 'tracks/late-night/electric-puddles.mp3',
    filePath: '/tmp/tracks/late-night/electric-puddles.mp3',
  },
  {
    title: 'Last Call in C Minor',
    slug: 'last-call-in-c-minor',
    category: 'jazzhop',
    categoryLabel: 'Jazzhop',
    file: 'tracks/jazzhop/last-call-in-c-minor.mp3',
    filePath: '/tmp/tracks/jazzhop/last-call-in-c-minor.mp3',
  },
  {
    title: 'Stacks of Quiet Hours',
    slug: 'stacks-of-quiet-hours',
    category: 'activities',
    categoryLabel: 'Activities',
    file: 'tracks/activities/stacks-of-quiet-hours.mp3',
    filePath: '/tmp/tracks/activities/stacks-of-quiet-hours.mp3',
  },
];

test('searchTracks prioritizes exact and prefix title matches', () => {
  const scope = buildTrackSearchScopes(tracks)[0];
  const results = searchTracks(tracks, 'electric puddles', scope);

  assert.equal(results[0]?.track.slug, 'electric-puddles');
});

test('searchTracks filters by category scope', () => {
  const scopes = buildTrackSearchScopes(tracks);
  const lateNight = scopes.find((scope) => scope.id === 'late-night');
  assert.ok(lateNight);

  const results = searchTracks(tracks, '', lateNight);
  assert.deepEqual(results.map((result) => result.track.slug), ['electric-puddles']);
});

test('searchTracks uses the current track as the empty-query anchor', () => {
  const scope = buildTrackSearchScopes(tracks)[0];
  const currentTrack = tracks[1];
  const results = searchTracks(tracks, '', scope, currentTrack);

  assert.equal(results[0]?.track.slug, currentTrack.slug);
});
