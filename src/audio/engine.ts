import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import Speaker from 'speaker';
import { type MixerState, activeAmbientKeys, buildWeights, muteMixerState } from './mixer.js';
import { createPlaybackPrebuffer } from './prebuffer.js';
import { SOUNDS_DIR } from '../runtime/paths.js';

const OUTPUT_CHANNELS = 2;
const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_BIT_DEPTH = 16;
// The node-speaker CoreAudio backend uses a 0.5s FIFO internally.
// Matching the first write to that buffer avoids startup underruns when we restart playback.
const MACOS_STARTUP_PREBUFFER_BYTES = Math.round(
  OUTPUT_SAMPLE_RATE * OUTPUT_CHANNELS * (OUTPUT_BIT_DEPTH / 8) * 0.5,
);
const MACOS_SPEAKER_SAMPLES_PER_FRAME =
  MACOS_STARTUP_PREBUFFER_BYTES / (OUTPUT_CHANNELS * (OUTPUT_BIT_DEPTH / 8));

export interface EngineOptions {
  track: string;
  mixerState: MixerState;
  url?: string;
  onTrackEnd?: () => void;
  onError?: (message: string) => void;
}

interface Pipeline {
  id: number;
  ffmpeg: ChildProcessByStdio<null, Readable, Readable>;
  speaker: Speaker;
}

let pipelineCounter = 0;

function formatErrorMessage(prefix: string, detail?: string): string {
  const trimmed = detail?.trim();
  if (!trimmed) return prefix;
  return `${prefix}\n${trimmed}`;
}

export class AudioEngine {
  private pipeline: Pipeline | null = null;
  private options: EngineOptions;
  private paused = false;
  private muted = false;
  private restartDebounce: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private trackPosition = 0;
  private trackResumedAt = 0;

  constructor(options: EngineOptions) {
    this.options = options;
  }

  start(): void {
    this.stopped = false;
    this.paused = false;
    this.trackPosition = 0;
    this.spawnPipeline();
  }

  stop(): void {
    this.stopped = true;
    if (this.restartDebounce) {
      clearTimeout(this.restartDebounce);
      this.restartDebounce = null;
    }
    this.killPipeline(this.pipeline);
    this.pipeline = null;
  }

  pause(): void {
    if (!this.pipeline || this.paused) return;
    this.trackPosition = this.getTrackPosition();
    this.paused = true;
    this.killPipeline(this.pipeline);
    this.pipeline = null;
  }

  resume(): void {
    if (!this.paused || this.stopped) return;
    this.paused = false;
    this.spawnPipeline();
  }

  togglePause(): boolean {
    if (this.paused) this.resume();
    else this.pause();
    return this.paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.scheduleRestart();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  updateMixer(state: MixerState): void {
    this.options.mixerState = state;
    this.scheduleRestart();
  }

  setTrack(track: string): void {
    this.options.track = track;
    this.options.url = undefined;
    this.trackPosition = 0;
    this.scheduleRestart();
  }

  setStream(url: string): void {
    this.options.url = url;
    this.trackPosition = 0;
    this.scheduleRestart();
  }

  getMixerState(): MixerState {
    return this.options.mixerState;
  }

  getTrack(): string {
    return this.options.track;
  }

  private getTrackPosition(): number {
    if (this.paused || !this.pipeline) return this.trackPosition;
    return this.trackPosition + (Date.now() - this.trackResumedAt) / 1000;
  }

  private scheduleRestart(): void {
    if (this.restartDebounce) clearTimeout(this.restartDebounce);
    this.restartDebounce = setTimeout(() => {
      this.restartDebounce = null;
      if (!this.stopped && !this.paused) this.restart();
    }, 150);
  }

  private restart(): void {
    if (this.stopped || this.paused) return;
    this.trackPosition = this.getTrackPosition();

    const oldPipeline = this.pipeline;
    this.pipeline = null;
    this.killPipeline(oldPipeline);
    this.spawnPipeline();
  }

  private buildArgs(): string[] {
    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
    const state = this.muted ? muteMixerState(this.options.mixerState) : this.options.mixerState;
    const active = activeAmbientKeys(state);
    const seekPosition = this.trackPosition;

    if (seekPosition > 0 && !this.options.url) {
      args.push('-ss', seekPosition.toFixed(2));
    }

    if (this.options.url) {
      args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
      args.push('-i', this.options.url);
    } else {
      args.push('-i', this.options.track);
    }

    for (const key of active) {
      args.push('-stream_loop', '-1', '-i', join(SOUNDS_DIR, `${key}.mp3`));
    }

    const inputCount = 1 + active.length;
    if (inputCount > 1) {
      const weights = buildWeights(state, active);
      args.push(
        '-filter_complex',
        `amix=inputs=${inputCount}:weights=${weights}:normalize=0:duration=first`
      );
    } else {
      args.push('-af', `volume=${state.music}`);
    }

    args.push(
      '-vn',
      '-f', 's16le',
      '-ar', String(OUTPUT_SAMPLE_RATE),
      '-ac', String(OUTPUT_CHANNELS),
      'pipe:1',
    );

    return args;
  }

  private spawnPipeline(): void {
    const id = ++pipelineCounter;
    const ffmpeg = spawn('ffmpeg', this.buildArgs(), { stdio: ['ignore', 'pipe', 'pipe'] });
    let speaker: Speaker;

    try {
      speaker = new Speaker({
        channels: OUTPUT_CHANNELS,
        bitDepth: OUTPUT_BIT_DEPTH,
        sampleRate: OUTPUT_SAMPLE_RATE,
        signed: true,
        samplesPerFrame: process.platform === 'darwin' ? MACOS_SPEAKER_SAMPLES_PER_FRAME : undefined,
      });
    } catch (error) {
      this.killProcess(ffmpeg);
      this.fail(formatErrorMessage('Unable to open audio output.', error instanceof Error ? error.message : String(error)));
      return;
    }

    let stderr = '';
    this.trackResumedAt = Date.now();
    this.pipeline = { id, ffmpeg, speaker };

    const playbackInput = createPlaybackPrebuffer(
      process.platform === 'darwin' ? MACOS_STARTUP_PREBUFFER_BYTES : 0,
    );
    ffmpeg.stdout.pipe(playbackInput).pipe(speaker);

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    ffmpeg.on('error', (error) => {
      if (this.pipeline?.id !== id) return;
      this.fail(formatErrorMessage('Failed to start ffmpeg.', error.message));
    });

    speaker.on('error', (error) => {
      if (this.pipeline?.id !== id) return;
      this.fail(formatErrorMessage('Audio output failed.', error.message));
    });

    ffmpeg.on('close', (code) => {
      if (this.pipeline?.id !== id) return;
      this.pipeline = null;

      if (code === 0 && !this.stopped && !this.paused && this.options.onTrackEnd) {
        this.trackPosition = 0;
        this.options.onTrackEnd();
        return;
      }

      if (code !== 0 && !this.stopped && !this.paused) {
        const message = formatErrorMessage('ffmpeg exited unexpectedly.', stderr);

        if (this.options.url) {
          setTimeout(() => {
            if (!this.stopped && !this.paused && !this.pipeline) {
              this.spawnPipeline();
            }
          }, 500);
          return;
        }

        this.fail(message);
      }
    });
  }

  private killPipeline(pipeline: Pipeline | null): void {
    if (!pipeline) return;

    try {
      pipeline.ffmpeg.stdout.unpipe(pipeline.speaker);
    } catch {}

    try {
      pipeline.ffmpeg.stdout.destroy();
    } catch {}

    try {
      pipeline.speaker.destroy();
    } catch {}

    this.killProcess(pipeline.ffmpeg);
  }

  private killProcess(processRef: ChildProcessByStdio<null, Readable, Readable>): void {
    try {
      processRef.kill('SIGTERM');
    } catch {}
  }

  private fail(message: string): void {
    if (this.stopped) return;
    this.stop();
    this.options.onError?.(message);
  }
}
