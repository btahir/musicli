import { PassThrough, Transform, type TransformCallback } from 'node:stream';

class StartupPrebufferTransform extends Transform {
  private readonly minimumBytes: number;
  private readonly bufferedChunks: Buffer[] = [];
  private bufferedBytes = 0;
  private started = false;

  constructor(minimumBytes: number) {
    super();
    this.minimumBytes = minimumBytes;
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.started) {
      callback(null, chunk);
      return;
    }

    this.bufferedChunks.push(chunk);
    this.bufferedBytes += chunk.length;

    if (this.bufferedBytes >= this.minimumBytes) {
      this.started = true;
      callback(null, Buffer.concat(this.bufferedChunks, this.bufferedBytes));
      this.bufferedChunks.length = 0;
      this.bufferedBytes = 0;
      return;
    }

    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this.started || this.bufferedBytes === 0) {
      callback();
      return;
    }

    callback(null, Buffer.concat(this.bufferedChunks, this.bufferedBytes));
  }
}

export function createPlaybackPrebuffer(minimumBytes: number): Transform | PassThrough {
  if (minimumBytes <= 0) {
    return new PassThrough();
  }

  return new StartupPrebufferTransform(minimumBytes);
}
