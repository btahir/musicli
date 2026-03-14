import type { RGB } from '../utils/color.js';

export interface Cell {
  char: string;
  fg: RGB;
  bg: RGB;
}

const DEFAULT_FG: RGB = [200, 200, 200];
const DEFAULT_BG: RGB = [0, 0, 0];

export class CellBuffer {
  width: number;
  height: number;
  cells: Cell[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    this.clear();
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (cell) {
        cell.char = ' ';
        cell.fg[0] = DEFAULT_FG[0]; cell.fg[1] = DEFAULT_FG[1]; cell.fg[2] = DEFAULT_FG[2];
        cell.bg[0] = DEFAULT_BG[0]; cell.bg[1] = DEFAULT_BG[1]; cell.bg[2] = DEFAULT_BG[2];
      } else {
        this.cells[i] = {
          char: ' ',
          fg: [DEFAULT_FG[0], DEFAULT_FG[1], DEFAULT_FG[2]],
          bg: [DEFAULT_BG[0], DEFAULT_BG[1], DEFAULT_BG[2]],
        };
      }
    }
  }

  get(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, char: string, fg?: RGB, bg?: RGB): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const cell = this.cells[y * this.width + x];
    cell.char = char;
    if (fg) { cell.fg[0] = fg[0]; cell.fg[1] = fg[1]; cell.fg[2] = fg[2]; }
    if (bg) { cell.bg[0] = bg[0]; cell.bg[1] = bg[1]; cell.bg[2] = bg[2]; }
  }

  writeText(x: number, y: number, text: string, fg?: RGB, bg?: RGB): void {
    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, text[i], fg, bg);
    }
  }

  fillRect(x: number, y: number, w: number, h: number, char: string, fg?: RGB, bg?: RGB): void {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        this.set(col, row, char, fg, bg);
      }
    }
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    this.clear();
  }

  copyFrom(other: CellBuffer): void {
    if (this.width !== other.width || this.height !== other.height) {
      this.resize(other.width, other.height);
    }
    for (let i = 0; i < this.cells.length; i++) {
      const src = other.cells[i];
      const dst = this.cells[i];
      dst.char = src.char;
      dst.fg[0] = src.fg[0]; dst.fg[1] = src.fg[1]; dst.fg[2] = src.fg[2];
      dst.bg[0] = src.bg[0]; dst.bg[1] = src.bg[1]; dst.bg[2] = src.bg[2];
    }
  }
}
