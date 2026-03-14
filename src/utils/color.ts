export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clamped),
    Math.round(a[1] + (b[1] - a[1]) * clamped),
    Math.round(a[2] + (b[2] - a[2]) * clamped),
  ];
}

export function dimColor(color: RGB, factor: number): RGB {
  return [
    Math.round(color[0] * factor),
    Math.round(color[1] * factor),
    Math.round(color[2] * factor),
  ];
}

export function fgAnsi(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bgAnsi(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

export const RESET = '\x1b[0m';
