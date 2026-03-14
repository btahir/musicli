import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { AudioEngine } from '../src/audio/engine.js';
import { defaultMixerState } from '../src/audio/mixer.js';
import { SOUNDS_DIR } from '../src/runtime/paths.js';

test('mute preserves the saved mix and allows edits while muted', () => {
  const mixer = defaultMixerState();
  mixer.music = 0.75;
  mixer.rain = 0.3;

  const engine = new AudioEngine({
    track: '/tmp/example.mp3',
    mixerState: mixer,
  });

  assert.equal(engine.isMuted(), false);
  engine.toggleMute();
  assert.equal(engine.isMuted(), true);
  assert.equal(engine.getMixerState().music, 0.75);
  assert.equal(engine.getMixerState().rain, 0.3);

  engine.updateMixer({
    ...engine.getMixerState(),
    music: 0.4,
    rain: 0.1,
  });
  assert.equal(engine.getMixerState().music, 0.4);
  assert.equal(engine.getMixerState().rain, 0.1);

  engine.toggleMute();
  assert.equal(engine.isMuted(), false);
  assert.equal(engine.getMixerState().music, 0.4);
  assert.equal(engine.getMixerState().rain, 0.1);

  engine.stop();
});

test('buildArgs includes ambient tracks without throwing', () => {
  const mixer = defaultMixerState();
  mixer.rain = 0.3;

  const engine = new AudioEngine({
    track: '/tmp/example.mp3',
    mixerState: mixer,
  });

  const args = (engine as unknown as { buildArgs(): string[] }).buildArgs();

  assert.ok(args.includes('-stream_loop'));
  assert.ok(args.includes('-i'));
  assert.ok(args.includes(join(SOUNDS_DIR, 'rain.mp3')));
  assert.ok(args.some((arg) => arg.includes('amix=inputs=2')));

  engine.stop();
});
