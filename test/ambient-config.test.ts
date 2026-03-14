import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { AMBIENT_KEYS } from '../src/audio/mixer.js';
import { PRESETS } from '../src/presets.js';

test('ambient config matches the shipped sound files', () => {
  const soundKeys = readdirSync(join(process.cwd(), 'sounds'))
    .filter((file) => file.endsWith('.mp3'))
    .map((file) => file.replace(/\.mp3$/, ''))
    .sort();

  assert.deepEqual([...AMBIENT_KEYS].sort(), soundKeys);
});

test('presets only reference shipped ambience keys', () => {
  const validKeys = new Set(AMBIENT_KEYS);

  for (const [presetName, preset] of Object.entries(PRESETS)) {
    for (const key of Object.keys(preset.ambience)) {
      assert.ok(validKeys.has(key as (typeof AMBIENT_KEYS)[number]), `${presetName} uses unknown ambience "${key}"`);
    }
  }
});
