import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { CellBuffer } from '../src/renderer/buffer.js';
import { SOUNDS_DIR, SCENES_DIR } from '../src/runtime/paths.js';
import { listSceneNames, loadScenes } from '../src/scenes/catalog.js';
import { PRESETS } from '../src/presets.js';

test('runtime asset directories resolve inside the repo', () => {
  assert.ok(existsSync(SOUNDS_DIR));
  assert.ok(existsSync(SCENES_DIR));
});

test('preset scenes are available', () => {
  const sceneNames = new Set(listSceneNames());

  assert.ok(sceneNames.size > 0);

  for (const [presetName, preset] of Object.entries(PRESETS)) {
    assert.ok(sceneNames.has(preset.scene), `${presetName} scene is missing: ${preset.scene}`);
  }
});

test('scene assets render into the terminal buffer', () => {
  const { sceneNames, scenes } = loadScenes();
  assert.ok(sceneNames.length > 0);

  const scene = scenes.get(sceneNames[0]);
  assert.ok(scene);

  scene.init(24, 12);
  const buffer = new CellBuffer(24, 12);
  scene.render(buffer, { x: 0, y: 0, width: 24, height: 12 });

  const inkedCells = buffer.cells.filter((cell) => cell.char !== ' ');
  assert.ok(inkedCells.length > 0);
});
