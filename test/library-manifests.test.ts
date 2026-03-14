import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('library repository metadata stays well-formed', () => {
  const root = process.cwd();
  const starter = readJson(join(root, 'library', 'manifests', 'starter.json'));
  const full = readJson(join(root, 'library', 'manifests', 'full.json'));
  const repository = readJson(join(root, 'library', 'repository.local.json'));

  assert.equal(repository.schemaVersion, 1);
  assert.equal(starter.schemaVersion, 1);
  assert.equal(full.schemaVersion, 1);
  assert.equal(repository.packs.starter.manifest, 'manifests/starter.json');
  assert.equal(repository.packs.full.manifest, 'manifests/full.json');
  assert.equal(starter.trackCount, 10);
  assert.equal(starter.tracks.length, 10);
  assert.equal(new Set(starter.tracks.map((track: { category: string }) => track.category)).size, 10);
  assert.equal(full.trackCount, full.tracks.length);
  assert.ok(full.trackCount >= starter.trackCount);
  assert.equal(repository.packs.starter.trackCount, starter.trackCount);
  assert.equal(repository.packs.full.trackCount, full.trackCount);
});
