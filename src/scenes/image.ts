import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { CellBuffer } from '../renderer/buffer.js';
import type { Region } from '../renderer/layout.js';
import type { RGB } from '../utils/color.js';
import type { Scene } from './types.js';

const BLACK: RGB = [0, 0, 0];
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const GRAYSCALE_LEVELS = [0, 18, 34, 54, 78, 108, 146, 192, 232];

interface SourceImage {
  width: number;
  height: number;
  luminance: Float32Array;
}

interface SceneCell {
  char: string;
  fg: RGB;
  bg: RGB;
}

interface SceneFrame {
  width: number;
  height: number;
  cells: SceneCell[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gray(level: number): RGB {
  return [level, level, level];
}

function toLuminance(r: number, g: number, b: number, alpha: number): number {
  const grayscale = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const normalized = clamp((grayscale * (alpha / 255)) / 255, 0, 1);
  const contrasted = clamp((normalized - 0.5) * 1.08 + 0.5, 0, 1);
  return contrasted * 255;
}

function decodeSourceImage(filePath: string): SourceImage {
  const png = PNG.sync.read(readFileSync(filePath));
  const luminance = new Float32Array(png.width * png.height);

  for (let i = 0; i < luminance.length; i++) {
    const base = i * 4;
    luminance[i] = toLuminance(
      png.data[base],
      png.data[base + 1],
      png.data[base + 2],
      png.data[base + 3],
    );
  }

  return { width: png.width, height: png.height, luminance };
}

function sampleBilinear(source: SourceImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(source.width - 1, x0 + 1);
  const y1 = Math.min(source.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const idx00 = y0 * source.width + x0;
  const idx10 = y0 * source.width + x1;
  const idx01 = y1 * source.width + x0;
  const idx11 = y1 * source.width + x1;

  const top = source.luminance[idx00] * (1 - tx) + source.luminance[idx10] * tx;
  const bottom = source.luminance[idx01] * (1 - tx) + source.luminance[idx11] * tx;
  return top * (1 - ty) + bottom * ty;
}

function renderTargetLuminance(source: SourceImage, pixelWidth: number, pixelHeight: number): Float32Array {
  const target = new Float32Array(pixelWidth * pixelHeight);
  const scale = Math.min(pixelWidth / source.width, pixelHeight / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const offsetX = (pixelWidth - drawWidth) / 2;
  const offsetY = (pixelHeight - drawHeight) / 2;

  for (let y = 0; y < pixelHeight; y++) {
    for (let x = 0; x < pixelWidth; x++) {
      const idx = y * pixelWidth + x;

      if (x < offsetX || x >= offsetX + drawWidth || y < offsetY || y >= offsetY + drawHeight) {
        target[idx] = 0;
        continue;
      }

      const sourceX = ((x - offsetX + 0.5) / drawWidth) * source.width - 0.5;
      const sourceY = ((y - offsetY + 0.5) / drawHeight) * source.height - 0.5;
      target[idx] = sampleBilinear(
        source,
        clamp(sourceX, 0, source.width - 1),
        clamp(sourceY, 0, source.height - 1),
      );
    }
  }

  return target;
}

function quantizeOrderedDither(samples: Float32Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(width * height);
  const stepScale = 1 / (GRAYSCALE_LEVELS.length - 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const normalized = clamp(samples[idx] / 255, 0, 1);
      const threshold = (BAYER_4X4[y % 4][x % 4] / 15) - 0.5;
      const adjusted = clamp(normalized + threshold * stepScale * 0.55, 0, 1);
      const levelIndex = Math.round(adjusted * (GRAYSCALE_LEVELS.length - 1));
      output[idx] = GRAYSCALE_LEVELS[levelIndex];
    }
  }

  return output;
}

function softenShadows(levels: Uint8Array): void {
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] === GRAYSCALE_LEVELS[1]) {
      levels[i] = 0;
    }
  }
}

function grayscalePixelToCell(levels: Uint8Array, pixelWidth: number, cellX: number, cellY: number): SceneCell {
  const top = levels[(cellY * 2) * pixelWidth + cellX];
  const bottom = levels[(cellY * 2 + 1) * pixelWidth + cellX];

  if (top === 0 && bottom === 0) {
    return { char: ' ', fg: BLACK, bg: BLACK };
  }

  if (top === bottom) {
    return { char: '█', fg: gray(top), bg: BLACK };
  }

  if (top === 0) {
    return { char: '▄', fg: gray(bottom), bg: BLACK };
  }

  if (bottom === 0) {
    return { char: '▀', fg: gray(top), bg: BLACK };
  }

  return { char: '▀', fg: gray(top), bg: gray(bottom) };
}

function renderFrame(source: SourceImage, width: number, height: number): SceneFrame {
  const pixelWidth = Math.max(1, width);
  const pixelHeight = Math.max(2, height * 2);
  const samples = renderTargetLuminance(source, pixelWidth, pixelHeight);
  const levels = quantizeOrderedDither(samples, pixelWidth, pixelHeight);
  softenShadows(levels);
  const cells = new Array<SceneCell>(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells[y * width + x] = grayscalePixelToCell(levels, pixelWidth, x, y);
    }
  }

  return { width, height, cells };
}

export class DitheredImageScene implements Scene {
  private readonly source: SourceImage;
  private readonly cache = new Map<string, SceneFrame>();

  constructor(filePath: string) {
    this.source = decodeSourceImage(filePath);
  }

  init(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const key = `${width}x${height}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, renderFrame(this.source, width, height));
    }
  }

  render(buffer: CellBuffer, region: Region): void {
    const width = Math.max(1, region.width);
    const height = Math.max(1, region.height);
    const key = `${width}x${height}`;
    if (!this.cache.has(key)) {
      this.init(width, height);
    }

    const frame = this.cache.get(key);
    if (!frame) return;

    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const cell = frame.cells[y * frame.width + x];
        buffer.set(region.x + x, region.y + y, cell.char, cell.fg, cell.bg);
      }
    }
  }
}
