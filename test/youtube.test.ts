import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYouTubeStreamArgs, isYouTubeUrl, YT_DLP_FORMAT_SELECTOR } from '../src/audio/youtube.js';

test('isYouTubeUrl recognizes common youtube URL shapes', () => {
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/jfKfPfyJRdk'), true);
  assert.equal(isYouTubeUrl('https://www.youtube.com/shorts/abc123'), true);
  assert.equal(isYouTubeUrl('https://example.com/audio.mp3'), false);
});

test('buildYouTubeStreamArgs requests a resilient playable format', () => {
  assert.equal(YT_DLP_FORMAT_SELECTOR, 'ba/bestaudio/best');
  assert.deepEqual(buildYouTubeStreamArgs('https://www.youtube.com/watch?v=jfKfPfyJRdk'), [
    '--no-playlist',
    '-g',
    '-f',
    'ba/bestaudio/best',
    'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  ]);
});
