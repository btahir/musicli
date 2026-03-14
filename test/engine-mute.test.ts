import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioEngine } from '../src/audio/engine.js';
import { defaultMixerState } from '../src/audio/mixer.js';

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

test('source and ambience args stay separated', () => {
  const mixer = defaultMixerState();
  mixer.rain = 0.3;

  const engine = new AudioEngine({
    track: '/tmp/example.mp3',
    mixerState: mixer,
  });

  const sourceArgs = (engine as unknown as { buildSourceArgs(): string[] }).buildSourceArgs();
  const ambientArgs = (engine as unknown as { buildAmbientArgs(key: 'rain'): string[] }).buildAmbientArgs('rain');

  assert.ok(sourceArgs.includes('/tmp/example.mp3'));
  assert.ok(!sourceArgs.includes('-stream_loop'));
  assert.ok(ambientArgs.includes('-stream_loop'));
  assert.ok(ambientArgs.some((arg) => arg.endsWith('/sounds/rain.mp3')));

  engine.stop();
});

test('stream mixer updates do not restart the source process for volume-only changes', () => {
  const mixer = defaultMixerState();
  mixer.rain = 0.3;

  const engine = new AudioEngine({
    track: '/tmp/example.mp3',
    mixerState: mixer,
    url: 'https://example.com/stream.m3u8',
  });

  const internal = engine as unknown as {
    stopped: boolean;
    paused: boolean;
    restartPlaybackGraph(): void;
    syncAmbientPipelines(): void;
  };
  const calls: string[] = [];

  internal.stopped = false;
  internal.paused = false;
  internal.restartPlaybackGraph = () => calls.push('source');
  internal.syncAmbientPipelines = () => calls.push('ambience');

  engine.updateMixer({
    ...engine.getMixerState(),
    music: 0.4,
    rain: 0.5,
  });
  assert.deepEqual(calls, []);

  engine.updateMixer({
    ...engine.getMixerState(),
    cafe: 0.2,
  });
  assert.deepEqual(calls, ['ambience']);

  engine.stop();
});

test('seekBy updates local playback position and ignores stream sources', () => {
  const engine = new AudioEngine({
    track: '/tmp/example.mp3',
    mixerState: defaultMixerState(),
  });

  (engine as unknown as { trackDuration: number | null }).trackDuration = 120;

  assert.equal(engine.canSeek(), true);
  assert.equal(engine.seekBy(10), true);
  assert.equal(engine.getPlaybackPosition(), 10);

  assert.equal(engine.seekBy(-30), true);
  assert.equal(engine.getPlaybackPosition(), 0);

  assert.equal(engine.seekBy(200), true);
  assert.equal(engine.getPlaybackPosition(), 120);

  engine.setStream('https://example.com/stream.m3u8');

  assert.equal(engine.canSeek(), false);
  assert.equal(engine.seekBy(-10), false);
  assert.equal(engine.getTrackDuration(), null);

  engine.stop();
});
