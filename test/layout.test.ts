import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLayout } from '../src/renderer/layout.js';

test('computeLayout collapses volume bars on short terminals', () => {
  const layout = computeLayout(80, 8);

  assert.equal(layout.volumeBars.height, 0);
  assert.ok(layout.scene.height >= 1);
  assert.ok(layout.nowPlaying.y >= 0);
  assert.ok(layout.hints.y < 8);
});

test('computeLayout keeps full chrome when enough rows are available', () => {
  const layout = computeLayout(80, 20);

  assert.ok(layout.volumeBars.height > 0);
  assert.ok(layout.separator1 < 20);
  assert.ok(layout.separator2 < 20);
  assert.ok(layout.separator3 < 20);
  assert.ok(layout.hints.y < 20);
});
