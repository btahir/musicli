declare module 'speaker' {
  import { Writable } from 'node:stream';

  interface SpeakerOptions {
    channels?: number;
    bitDepth?: number;
    sampleRate?: number;
    signed?: boolean;
    float?: boolean;
    samplesPerFrame?: number;
    device?: string;
  }

  class Speaker extends Writable {
    constructor(options?: SpeakerOptions);
    close(flush?: boolean): void;
  }

  export = Speaker;
}
