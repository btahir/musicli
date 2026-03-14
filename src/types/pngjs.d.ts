declare module 'pngjs' {
  export interface PngImage {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export class PNG implements PngImage {
    width: number;
    height: number;
    data: Uint8Array;
    constructor(options?: Record<string, unknown>);

    static sync: {
      read(buffer: Uint8Array): PNG;
      write(image: PngImage): Buffer;
    };
  }
}
