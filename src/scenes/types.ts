import type { CellBuffer } from '../renderer/buffer.js';
import type { Region } from '../renderer/layout.js';

export interface Scene {
  init(width: number, height: number): void;
  render(buffer: CellBuffer, region: Region): void;
}
