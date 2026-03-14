import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process';
import { join } from 'node:path';
import { PassThrough, type Duplex, type Readable } from 'node:stream';
import Speaker from 'speaker';
import { type AmbientKey, type MixerState, activeAmbientKeys } from './mixer.js';
import { createPlaybackPrebuffer } from './prebuffer.js';
import { SOUNDS_DIR } from '../runtime/paths.js';

const OUTPUT_CHANNELS = 2;
const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_BIT_DEPTH = 16;
const PCM_FRAME_BYTES = OUTPUT_CHANNELS * (OUTPUT_BIT_DEPTH / 8);
const MAX_AMBIENT_QUEUE_BYTES = OUTPUT_SAMPLE_RATE * PCM_FRAME_BYTES * 2;
// The node-speaker CoreAudio backend uses a 0.5s FIFO internally.
// Matching the first write to that buffer avoids startup underruns when we start playback.
const MACOS_STARTUP_PREBUFFER_BYTES = Math.round(OUTPUT_SAMPLE_RATE * PCM_FRAME_BYTES * 0.5);
const MACOS_SPEAKER_SAMPLES_PER_FRAME = MACOS_STARTUP_PREBUFFER_BYTES / PCM_FRAME_BYTES;

export interface EngineOptions {
  track: string;
  mixerState: MixerState;
  url?: string;
  onTrackEnd?: () => void;
  onError?: (message: string) => void;
}

interface AudioProcess {
  id: number;
  ffmpeg: ChildProcessByStdio<null, Readable, Readable>;
  stderr: string;
}

interface SourceProcess extends AudioProcess {}

interface AmbientProcess extends AudioProcess {
  key: AmbientKey;
  queue: ByteQueue;
}

interface OutputPipeline {
  id: number;
  input: PassThrough;
  prebuffer: Duplex;
  speaker: Speaker;
}

let processCounter = 0;
let outputCounter = 0;
const durationCache = new Map<string, number | null>();

function formatErrorMessage(prefix: string, detail?: string): string {
  const trimmed = detail?.trim();
  if (!trimmed) return prefix;
  return `${prefix}\n${trimmed}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function probeTrackDuration(track: string): number | null {
  if (!track) return null;
  if (durationCache.has(track)) return durationCache.get(track) ?? null;

  try {
    const output = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        track,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const parsed = Number.parseFloat(output);
    const duration = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    durationCache.set(track, duration);
    return duration;
  } catch {
    durationCache.set(track, null);
    return null;
  }
}

class ByteQueue {
  private chunks: Buffer[] = [];
  private bufferedBytes = 0;

  append(chunk: Buffer): void {
    if (!chunk.length) return;
    this.chunks.push(chunk);
    this.bufferedBytes += chunk.length;
    this.trimTo(MAX_AMBIENT_QUEUE_BYTES);
  }

  consume(size: number): Buffer {
    if (size <= 0) return Buffer.alloc(0);

    const output = Buffer.alloc(size);
    let offset = 0;

    while (offset < size && this.chunks.length) {
      const chunk = this.chunks[0]!;
      const take = Math.min(chunk.length, size - offset);
      chunk.copy(output, offset, 0, take);
      offset += take;
      this.bufferedBytes -= take;

      if (take === chunk.length) {
        this.chunks.shift();
      } else {
        this.chunks[0] = chunk.subarray(take);
      }
    }

    return output;
  }

  clear(): void {
    this.chunks = [];
    this.bufferedBytes = 0;
  }

  private trimTo(maxBytes: number): void {
    if (this.bufferedBytes <= maxBytes) return;

    let bytesToDrop = this.bufferedBytes - maxBytes;

    while (bytesToDrop > 0 && this.chunks.length) {
      const chunk = this.chunks[0]!;
      const drop = Math.min(chunk.length, bytesToDrop);
      this.bufferedBytes -= drop;
      bytesToDrop -= drop;

      if (drop === chunk.length) {
        this.chunks.shift();
      } else {
        this.chunks[0] = chunk.subarray(drop);
      }
    }
  }
}

export class AudioEngine {
  private output: OutputPipeline | null = null;
  private source: SourceProcess | null = null;
  private ambience = new Map<AmbientKey, AmbientProcess>();
  private options: EngineOptions;
  private paused = false;
  private muted = false;
  private stopped = true;
  private trackPosition = 0;
  private trackResumedAt = 0;
  private trackDuration: number | null;
  private sourceRemainder: Buffer = Buffer.alloc(0);
  private sourceBackpressured = false;

  constructor(options: EngineOptions) {
    this.options = options;
    this.trackDuration = options.url ? null : probeTrackDuration(options.track);
  }

  start(): void {
    this.stopped = false;
    this.paused = false;
    this.trackPosition = 0;
    this.sourceRemainder = Buffer.alloc(0);
    this.sourceBackpressured = false;

    if (!this.ensureOutputPipeline()) return;
    this.spawnSourceProcess();
    this.syncAmbientPipelines();
  }

  stop(): void {
    this.stopped = true;
    this.killSourceProcess();
    this.killAllAmbientPipelines();
    this.destroyOutputPipeline();
    this.sourceRemainder = Buffer.alloc(0);
    this.sourceBackpressured = false;
  }

  pause(): void {
    if (this.paused || this.stopped) return;
    this.trackPosition = this.getTrackPosition();
    this.paused = true;
    this.killSourceProcess();
    this.killAllAmbientPipelines();
    this.destroyOutputPipeline();
    this.sourceBackpressured = false;
  }

  resume(): void {
    if (!this.paused || this.stopped) return;
    this.paused = false;
    if (!this.ensureOutputPipeline()) return;
    this.spawnSourceProcess();
    this.syncAmbientPipelines();
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
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  updateMixer(state: MixerState): void {
    const previousActive = new Set(activeAmbientKeys(this.options.mixerState));
    const nextActive = new Set(activeAmbientKeys(state));
    this.options.mixerState = state;

    if (this.stopped || this.paused) return;
    if (!this.activeAmbientSetChanged(previousActive, nextActive)) return;

    this.syncAmbientPipelines();
  }

  setTrack(track: string): void {
    this.options.track = track;
    this.options.url = undefined;
    this.trackPosition = 0;
    this.trackDuration = probeTrackDuration(track);
    this.restartPlaybackGraph();
  }

  setStream(url: string): void {
    this.options.url = url;
    this.trackPosition = 0;
    this.trackDuration = null;
    this.restartPlaybackGraph();
  }

  getMixerState(): MixerState {
    return this.options.mixerState;
  }

  getTrack(): string {
    return this.options.track;
  }

  canSeek(): boolean {
    return !this.options.url;
  }

  getPlaybackPosition(): number {
    return this.getTrackPosition();
  }

  getTrackDuration(): number | null {
    return this.trackDuration;
  }

  seekBy(deltaSeconds: number): boolean {
    if (this.options.url) return false;

    const currentPosition = this.getTrackPosition();
    const upperBound = this.trackDuration ?? Math.max(0, currentPosition + deltaSeconds);
    const nextPosition = clamp(currentPosition + deltaSeconds, 0, upperBound);

    if (Math.abs(nextPosition - currentPosition) < 0.01) return false;

    this.trackPosition = nextPosition;

    if (!this.paused && !this.stopped) {
      this.restartPlaybackGraph();
    }

    return true;
  }

  private activeAmbientSetChanged(previous: Set<AmbientKey>, next: Set<AmbientKey>): boolean {
    if (previous.size !== next.size) return true;
    for (const key of previous) {
      if (!next.has(key)) return true;
    }
    return false;
  }

  private getTrackPosition(): number {
    const runningPosition =
      this.paused || !this.source
        ? this.trackPosition
        : this.trackPosition + (Date.now() - this.trackResumedAt) / 1000;

    if (this.trackDuration === null) return Math.max(0, runningPosition);
    return clamp(runningPosition, 0, this.trackDuration);
  }

  private buildSourceArgs(): string[] {
    const args: string[] = ['-hide_banner', '-loglevel', 'error', '-nostdin'];

    if (this.trackPosition > 0 && !this.options.url) {
      args.push('-ss', this.trackPosition.toFixed(2));
    }

    if (this.options.url) {
      args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
      args.push('-i', this.options.url);
    } else {
      args.push('-i', this.options.track);
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

  private buildAmbientArgs(key: AmbientKey): string[] {
    return [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-stream_loop',
      '-1',
      '-i',
      join(SOUNDS_DIR, `${key}.mp3`),
      '-vn',
      '-f',
      's16le',
      '-ar',
      String(OUTPUT_SAMPLE_RATE),
      '-ac',
      String(OUTPUT_CHANNELS),
      'pipe:1',
    ];
  }

  private ensureOutputPipeline(): boolean {
    if (this.output) return true;

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
      this.fail(
        formatErrorMessage(
          'Unable to open audio output.',
          error instanceof Error ? error.message : String(error),
        ),
      );
      return false;
    }

    const input = new PassThrough();
    const prebuffer = createPlaybackPrebuffer(
      process.platform === 'darwin' ? MACOS_STARTUP_PREBUFFER_BYTES : 0,
    );

    input.pipe(prebuffer).pipe(speaker);

    const id = ++outputCounter;
    this.output = { id, input, prebuffer, speaker };

    input.on('drain', () => {
      if (this.output?.id !== id) return;
      if (!this.sourceBackpressured || !this.source) return;

      this.sourceBackpressured = false;
      this.source.ffmpeg.stdout.resume();
    });

    speaker.on('error', (error) => {
      if (this.output?.id !== id) return;
      this.fail(formatErrorMessage('Audio output failed.', error.message));
    });

    return true;
  }

  private destroyOutputPipeline(): void {
    if (!this.output) return;

    const output = this.output;
    this.output = null;

    try {
      output.input.unpipe(output.prebuffer);
    } catch {}

    try {
      output.prebuffer.unpipe(output.speaker);
    } catch {}

    try {
      output.input.destroy();
    } catch {}

    try {
      if ('destroy' in output.prebuffer && typeof output.prebuffer.destroy === 'function') {
        output.prebuffer.destroy();
      }
    } catch {}

    try {
      output.speaker.destroy();
    } catch {}
  }

  private spawnSourceProcess(): void {
    if (this.stopped || this.paused) return;
    if (!this.ensureOutputPipeline()) return;

    const id = ++processCounter;
    const ffmpeg = spawn('ffmpeg', this.buildSourceArgs(), { stdio: ['ignore', 'pipe', 'pipe'] });
    const source: SourceProcess = { id, ffmpeg, stderr: '' };
    this.source = source;
    this.sourceRemainder = Buffer.alloc(0);
    this.sourceBackpressured = false;
    this.trackResumedAt = Date.now();

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      if (this.source?.id !== id) return;
      this.handleSourceChunk(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      if (this.source?.id !== id) return;
      source.stderr += chunk.toString();
      if (source.stderr.length > 4000) source.stderr = source.stderr.slice(-4000);
    });

    ffmpeg.on('error', (error) => {
      if (this.source?.id !== id) return;
      this.fail(formatErrorMessage('Failed to start ffmpeg.', error.message));
    });

    ffmpeg.on('close', (code) => {
      if (this.source?.id !== id) return;
      this.source = null;
      this.sourceRemainder = Buffer.alloc(0);
      this.sourceBackpressured = false;

      if (this.stopped || this.paused) return;

      if (code === 0 && !this.options.url && this.options.onTrackEnd) {
        this.trackPosition = 0;
        this.options.onTrackEnd();
        return;
      }

      if (code !== 0) {
        const message = formatErrorMessage('ffmpeg exited unexpectedly.', source.stderr);

        if (this.options.url) {
          setTimeout(() => {
            if (!this.stopped && !this.paused && !this.source) {
              this.spawnSourceProcess();
            }
          }, 500);
          return;
        }

        this.fail(message);
      }
    });
  }

  private handleSourceChunk(chunk: Buffer): void {
    if (!this.output) return;

    let sourceChunk = chunk;
    if (this.sourceRemainder.length) {
      sourceChunk = Buffer.concat([this.sourceRemainder, chunk]);
      this.sourceRemainder = Buffer.alloc(0);
    }

    const evenLength = sourceChunk.length - (sourceChunk.length % 2);
    if (evenLength <= 0) {
      this.sourceRemainder = Buffer.from(sourceChunk);
      return;
    }

    if (evenLength !== sourceChunk.length) {
      this.sourceRemainder = Buffer.from(sourceChunk.subarray(evenLength));
      sourceChunk = Buffer.from(sourceChunk.subarray(0, evenLength));
    }

    const mixedChunk = this.mixChunk(sourceChunk);
    const accepted = this.output.input.write(mixedChunk);

    if (!accepted && this.source && !this.sourceBackpressured) {
      this.sourceBackpressured = true;
      this.source.ffmpeg.stdout.pause();
    }
  }

  private mixChunk(sourceChunk: Buffer): Buffer {
    const state = this.options.mixerState;
    const trackGain = this.muted ? 0 : state.music;
    const activeKeys = activeAmbientKeys(state);
    const ambienceBuffers = activeKeys.map((key) => ({
      key,
      gain: this.muted ? 0 : state[key],
      buffer: this.ambience.get(key)?.queue.consume(sourceChunk.length) ?? Buffer.alloc(sourceChunk.length),
    }));

    const hasAudibleAmbience = ambienceBuffers.some(({ gain }) => gain > 0);
    if (!hasAudibleAmbience && trackGain === 1) {
      return sourceChunk;
    }

    if (!hasAudibleAmbience && trackGain === 0) {
      return Buffer.alloc(sourceChunk.length);
    }

    const output = Buffer.allocUnsafe(sourceChunk.length);

    for (let offset = 0; offset < sourceChunk.length; offset += 2) {
      let mixedSample = Math.round(sourceChunk.readInt16LE(offset) * trackGain);

      for (const ambience of ambienceBuffers) {
        if (ambience.gain <= 0) continue;
        mixedSample += Math.round(ambience.buffer.readInt16LE(offset) * ambience.gain);
      }

      output.writeInt16LE(clamp(mixedSample, -32768, 32767), offset);
    }

    return output;
  }

  private syncAmbientPipelines(): void {
    const desired = new Set(activeAmbientKeys(this.options.mixerState));

    for (const [key] of this.ambience) {
      if (!desired.has(key)) {
        this.killAmbientPipeline(key);
      }
    }

    if (this.stopped || this.paused) return;

    for (const key of desired) {
      if (this.ambience.has(key)) continue;
      this.spawnAmbientPipeline(key);
    }
  }

  private spawnAmbientPipeline(key: AmbientKey): void {
    const id = ++processCounter;
    const ffmpeg = spawn('ffmpeg', this.buildAmbientArgs(key), { stdio: ['ignore', 'pipe', 'pipe'] });
    const pipeline: AmbientProcess = {
      id,
      key,
      ffmpeg,
      stderr: '',
      queue: new ByteQueue(),
    };

    this.ambience.set(key, pipeline);

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      const current = this.ambience.get(key);
      if (!current || current.id !== id) return;
      current.queue.append(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      const current = this.ambience.get(key);
      if (!current || current.id !== id) return;
      current.stderr += chunk.toString();
      if (current.stderr.length > 4000) current.stderr = current.stderr.slice(-4000);
    });

    ffmpeg.on('error', (error) => {
      const current = this.ambience.get(key);
      if (!current || current.id !== id) return;
      this.fail(formatErrorMessage(`Failed to start ambience "${key}".`, error.message));
    });

    ffmpeg.on('close', (code) => {
      const current = this.ambience.get(key);
      if (!current || current.id !== id) return;
      this.ambience.delete(key);

      if (this.stopped || this.paused) return;

      if (code !== 0) {
        this.fail(formatErrorMessage(`Ambience "${key}" exited unexpectedly.`, current.stderr));
        return;
      }

      if (activeAmbientKeys(this.options.mixerState).includes(key)) {
        this.spawnAmbientPipeline(key);
      }
    });
  }

  private restartPlaybackGraph(): void {
    if (this.stopped) return;
    if (this.paused) return;

    this.killSourceProcess();
    this.killAllAmbientPipelines();
    this.destroyOutputPipeline();
    this.sourceRemainder = Buffer.alloc(0);
    this.sourceBackpressured = false;

    if (!this.ensureOutputPipeline()) return;
    this.spawnSourceProcess();
    this.syncAmbientPipelines();
  }

  private killSourceProcess(): void {
    if (!this.source) return;

    const source = this.source;
    this.source = null;
    this.sourceRemainder = Buffer.alloc(0);
    this.sourceBackpressured = false;

    try {
      source.ffmpeg.stdout.destroy();
    } catch {}

    this.killProcess(source.ffmpeg);
  }

  private killAmbientPipeline(key: AmbientKey): void {
    const pipeline = this.ambience.get(key);
    if (!pipeline) return;

    this.ambience.delete(key);
    pipeline.queue.clear();

    try {
      pipeline.ffmpeg.stdout.destroy();
    } catch {}

    this.killProcess(pipeline.ffmpeg);
  }

  private killAllAmbientPipelines(): void {
    for (const key of [...this.ambience.keys()]) {
      this.killAmbientPipeline(key);
    }
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
