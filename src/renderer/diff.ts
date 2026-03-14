import { CellBuffer } from './buffer.js';

const SYNC_START = '\x1b[?2026h';
const SYNC_END = '\x1b[?2026l';

function moveCursor(row: number, col: number): string {
  return `\x1b[${row + 1};${col + 1}H`;
}

function fgSeq(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bgSeq(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

export function diffBuffers(current: CellBuffer, previous: CellBuffer | null): string {
  const parts: string[] = [SYNC_START];
  let lastFgR = -1, lastFgG = -1, lastFgB = -1;
  let lastBgR = -1, lastBgG = -1, lastBgB = -1;
  let lastRow = -1, lastCol = -1;

  for (let y = 0; y < current.height; y++) {
    for (let x = 0; x < current.width; x++) {
      const idx = y * current.width + x;
      const cell = current.cells[idx];

      if (previous) {
        const prev = previous.cells[idx];
        if (
          prev &&
          cell.char === prev.char &&
          cell.fg[0] === prev.fg[0] && cell.fg[1] === prev.fg[1] && cell.fg[2] === prev.fg[2] &&
          cell.bg[0] === prev.bg[0] && cell.bg[1] === prev.bg[1] && cell.bg[2] === prev.bg[2]
        ) {
          continue;
        }
      }

      if (lastRow !== y || lastCol !== x) {
        parts.push(moveCursor(y, x));
      }

      if (cell.fg[0] !== lastFgR || cell.fg[1] !== lastFgG || cell.fg[2] !== lastFgB) {
        parts.push(fgSeq(cell.fg[0], cell.fg[1], cell.fg[2]));
        lastFgR = cell.fg[0]; lastFgG = cell.fg[1]; lastFgB = cell.fg[2];
      }

      if (cell.bg[0] !== lastBgR || cell.bg[1] !== lastBgG || cell.bg[2] !== lastBgB) {
        parts.push(bgSeq(cell.bg[0], cell.bg[1], cell.bg[2]));
        lastBgR = cell.bg[0]; lastBgG = cell.bg[1]; lastBgB = cell.bg[2];
      }

      parts.push(cell.char);
      lastRow = y;
      lastCol = x + 1;
    }
  }

  parts.push('\x1b[0m');
  parts.push(SYNC_END);
  return parts.join('');
}
