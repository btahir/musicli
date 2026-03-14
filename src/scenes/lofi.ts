import type { CellBuffer } from '../renderer/buffer.js';
import type { Region } from '../renderer/layout.js';
import { dimColor, hexToRgb, lerpColor, type RGB } from '../utils/color.js';
import type { Scene } from './types.js';

type SceneName =
  | 'alley'
  | 'balcony'
  | 'bookshop'
  | 'city'
  | 'park'
  | 'porch'
  | 'rooftop'
  | 'treehouse';

interface SceneTheme {
  name: SceneName;
  skyTop: RGB;
  skyBottom: RGB;
  horizon: RGB;
  silhouette: RGB;
  silhouetteSoft: RGB;
  accent: RGB;
  accentSoft: RGB;
  glow: RGB;
  weather: 'none' | 'rain' | 'snow' | 'dust' | 'fireflies';
  mode: 'city' | 'balcony' | 'bookshop' | 'park' | 'porch' | 'rooftop' | 'treehouse' | 'alley';
  moon?: RGB;
}

const THEMES: Record<SceneName, SceneTheme> = {
  city: {
    name: 'city',
    mode: 'city',
    skyTop: hexToRgb('#07111f'),
    skyBottom: hexToRgb('#16253b'),
    horizon: hexToRgb('#25364f'),
    silhouette: hexToRgb('#0a1020'),
    silhouetteSoft: hexToRgb('#14243c'),
    accent: hexToRgb('#f2d38d'),
    accentSoft: hexToRgb('#5f7aa5'),
    glow: hexToRgb('#9fb8d6'),
    weather: 'none',
    moon: hexToRgb('#d8e2ef'),
  },
  balcony: {
    name: 'balcony',
    mode: 'balcony',
    skyTop: hexToRgb('#102039'),
    skyBottom: hexToRgb('#31445b'),
    horizon: hexToRgb('#5a4b4a'),
    silhouette: hexToRgb('#151d31'),
    silhouetteSoft: hexToRgb('#22344d'),
    accent: hexToRgb('#f3c57b'),
    accentSoft: hexToRgb('#7cc7bc'),
    glow: hexToRgb('#ffe7a3'),
    weather: 'none',
    moon: hexToRgb('#f4efe3'),
  },
  rooftop: {
    name: 'rooftop',
    mode: 'rooftop',
    skyTop: hexToRgb('#061018'),
    skyBottom: hexToRgb('#1b2c37'),
    horizon: hexToRgb('#253d4d'),
    silhouette: hexToRgb('#0a131f'),
    silhouetteSoft: hexToRgb('#1a2936'),
    accent: hexToRgb('#ffd28b'),
    accentSoft: hexToRgb('#83abc7'),
    glow: hexToRgb('#ebf2ff'),
    weather: 'none',
    moon: hexToRgb('#dbe6ef'),
  },
  alley: {
    name: 'alley',
    mode: 'alley',
    skyTop: hexToRgb('#04080e'),
    skyBottom: hexToRgb('#0f1823'),
    horizon: hexToRgb('#171f2d'),
    silhouette: hexToRgb('#05070b'),
    silhouetteSoft: hexToRgb('#121823'),
    accent: hexToRgb('#38d0c3'),
    accentSoft: hexToRgb('#ff8b6f'),
    glow: hexToRgb('#8dc1da'),
    weather: 'rain',
  },
  treehouse: {
    name: 'treehouse',
    mode: 'treehouse',
    skyTop: hexToRgb('#06111a'),
    skyBottom: hexToRgb('#132431'),
    horizon: hexToRgb('#1a3436'),
    silhouette: hexToRgb('#07140f'),
    silhouetteSoft: hexToRgb('#173123'),
    accent: hexToRgb('#d7b46a'),
    accentSoft: hexToRgb('#8bd28a'),
    glow: hexToRgb('#f1e6ad'),
    weather: 'fireflies',
    moon: hexToRgb('#dde7dc'),
  },
  park: {
    name: 'park',
    mode: 'park',
    skyTop: hexToRgb('#09131f'),
    skyBottom: hexToRgb('#1f3541'),
    horizon: hexToRgb('#2f524e'),
    silhouette: hexToRgb('#0b1a16'),
    silhouetteSoft: hexToRgb('#183229'),
    accent: hexToRgb('#9fd56f'),
    accentSoft: hexToRgb('#80b8d8'),
    glow: hexToRgb('#edf7bf'),
    weather: 'fireflies',
    moon: hexToRgb('#d9e7d7'),
  },
  porch: {
    name: 'porch',
    mode: 'porch',
    skyTop: hexToRgb('#09121d'),
    skyBottom: hexToRgb('#23384d'),
    horizon: hexToRgb('#344c60'),
    silhouette: hexToRgb('#0b1016'),
    silhouetteSoft: hexToRgb('#202c36'),
    accent: hexToRgb('#f2d48d'),
    accentSoft: hexToRgb('#b4d5ec'),
    glow: hexToRgb('#fff1c7'),
    weather: 'snow',
    moon: hexToRgb('#edf3fb'),
  },
  bookshop: {
    name: 'bookshop',
    mode: 'bookshop',
    skyTop: hexToRgb('#1a120b'),
    skyBottom: hexToRgb('#39261a'),
    horizon: hexToRgb('#513724'),
    silhouette: hexToRgb('#140d08'),
    silhouetteSoft: hexToRgb('#3b2818'),
    accent: hexToRgb('#f0c27a'),
    accentSoft: hexToRgb('#c2875b'),
    glow: hexToRgb('#ffe6aa'),
    weather: 'dust',
  },
};

export const PROCEDURAL_SCENE_NAMES = Object.keys(THEMES) as SceneName[];

function clone(color: RGB): RGB {
  return [color[0], color[1], color[2]];
}

function hash(seed: number, x: number, y: number): number {
  let value = (x * 374761393 + y * 668265263 + seed * 1442695041) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 0xffffffff;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothPulse(t: number, phase: number, speed = 1): number {
  return 0.5 + 0.5 * Math.sin(t * speed + phase);
}

function writeCell(
  buffer: CellBuffer,
  region: Region,
  x: number,
  y: number,
  char: string,
  fg?: RGB,
  bg?: RGB,
): void {
  if (x < 0 || y < 0 || x >= region.width || y >= region.height) return;
  buffer.set(region.x + x, region.y + y, char, fg, bg);
}

function currentBg(buffer: CellBuffer, region: Region, x: number, y: number): RGB {
  return clone(buffer.get(region.x + x, region.y + y)?.bg ?? [0, 0, 0]);
}

function fillLocalRect(
  buffer: CellBuffer,
  region: Region,
  x: number,
  y: number,
  width: number,
  height: number,
  bg: RGB,
): void {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      writeCell(buffer, region, col, row, ' ', bg, bg);
    }
  }
}

function fillGradient(buffer: CellBuffer, region: Region, top: RGB, bottom: RGB): void {
  const maxY = Math.max(1, region.height - 1);
  for (let y = 0; y < region.height; y++) {
    const rowColor = lerpColor(top, bottom, y / maxY);
    for (let x = 0; x < region.width; x++) {
      const vignette = 1 - Math.abs((x / Math.max(1, region.width - 1)) - 0.5) * 0.1;
      const pixel = dimColor(rowColor, vignette);
      writeCell(buffer, region, x, y, ' ', pixel, pixel);
    }
  }
}

function drawMoon(buffer: CellBuffer, region: Region, cx: number, cy: number, radius: number, color: RGB): void {
  const glow = dimColor(color, 0.3);
  for (let y = cy - radius - 1; y <= cy + radius + 1; y++) {
    for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius) {
        writeCell(buffer, region, x, y, '●', color, currentBg(buffer, region, x, y));
      } else if (distance <= radius + 1.15 && hash(47, x, y) > 0.55) {
        writeCell(buffer, region, x, y, '·', glow, currentBg(buffer, region, x, y));
      }
    }
  }
}

function drawStars(buffer: CellBuffer, region: Region, color: RGB, t: number, horizonRow: number, seed: number): void {
  const cap = Math.max(1, horizonRow);
  for (let y = 0; y < cap; y++) {
    for (let x = 0; x < region.width; x++) {
      const chance = hash(seed, x, y);
      if (chance < 0.985) continue;
      const twinkle = smoothPulse(t, hash(seed + 1, x, y) * Math.PI * 2, 1.3);
      const starColor = lerpColor(dimColor(color, 0.35), color, twinkle);
      const char = chance > 0.996 ? '✦' : chance > 0.992 ? '•' : '·';
      writeCell(buffer, region, x, y, char, starColor, currentBg(buffer, region, x, y));
    }
  }
}

function drawSkyline(
  buffer: CellBuffer,
  region: Region,
  baseY: number,
  color: RGB,
  windowColor: RGB,
  seed: number,
  minHeight: number,
  maxHeight: number,
  widthScale = 1,
): void {
  let x = 0;
  let block = 0;

  while (x < region.width) {
    const buildingWidth = Math.max(2, Math.round((3 + hash(seed, block, 0) * 6) * widthScale));
    const buildingHeight = minHeight + Math.floor(hash(seed, block, 1) * Math.max(1, maxHeight - minHeight + 1));
    const top = Math.max(0, baseY - buildingHeight);
    const width = Math.min(buildingWidth, region.width - x);

    fillLocalRect(buffer, region, x, top, width, Math.max(0, baseY - top), color);

    if (width >= 3 && buildingHeight >= 3) {
      for (let wy = top + 1; wy < baseY - 1; wy += 2) {
        for (let wx = x + 1; wx < x + width - 1; wx += 2) {
          if (hash(seed + 2, wx, wy) > 0.7) {
            writeCell(buffer, region, wx, wy, '▪', windowColor, color);
          }
        }
      }
    }

    if (hash(seed + 3, block, 0) > 0.76 && width >= 2) {
      writeCell(buffer, region, x + Math.floor(width / 2), top - 1, '┬', dimColor(windowColor, 0.6), currentBg(buffer, region, x + Math.floor(width / 2), Math.max(0, top - 1)));
    }

    x += width;
    block += 1;
  }
}

function drawRain(buffer: CellBuffer, region: Region, color: RGB, t: number, seed: number): void {
  const speed = region.height * 0.9;
  for (let x = 0; x < region.width; x++) {
    if (hash(seed, x, 0) < 0.55) continue;
    const offset = hash(seed + 1, x, 0) * region.height;
    const head = (t * speed + offset) % (region.height + 3);

    for (let segment = 0; segment < 3; segment++) {
      const y = Math.floor(head) - segment * 2;
      const trailX = x - segment;
      if (y < 0 || y >= region.height || trailX < 0 || trailX >= region.width) continue;
      writeCell(buffer, region, trailX, y, '╲', dimColor(color, 1 - segment * 0.25), currentBg(buffer, region, trailX, y));
    }
  }
}

function drawSnow(buffer: CellBuffer, region: Region, color: RGB, t: number, seed: number): void {
  for (let x = 0; x < region.width; x++) {
    if (hash(seed, x, 0) < 0.6) continue;
    const drift = Math.round(Math.sin(t * 0.8 + x * 0.33) * 1.5);
    const y = Math.floor((t * 2.5 + hash(seed + 1, x, 0) * region.height) % (region.height + 1));
    const px = clamp(x + drift, 0, region.width - 1);
    const char = hash(seed + 2, x, y) > 0.7 ? '✦' : '·';
    writeCell(buffer, region, px, y, char, color, currentBg(buffer, region, px, y));
  }
}

function drawFireflies(buffer: CellBuffer, region: Region, color: RGB, t: number, seed: number, floorY: number): void {
  const count = Math.max(5, Math.floor(region.width / 6));
  for (let i = 0; i < count; i++) {
    const baseX = hash(seed, i, 0) * region.width;
    const baseY = floorY - hash(seed, i, 1) * Math.max(2, floorY - 2);
    const x = Math.round(baseX + Math.sin(t * 0.8 + i * 1.7) * 2);
    const y = Math.round(baseY + Math.cos(t * 1.1 + i * 0.9));
    const pulse = smoothPulse(t, i * 0.8, 1.5);
    const glow = lerpColor(dimColor(color, 0.35), color, pulse);
    writeCell(buffer, region, x, y, pulse > 0.82 ? '✦' : '•', glow, currentBg(buffer, region, x, y));
  }
}

function drawDust(buffer: CellBuffer, region: Region, color: RGB, t: number, seed: number): void {
  const count = Math.max(6, Math.floor(region.width / 5));
  for (let i = 0; i < count; i++) {
    const x = Math.round((hash(seed, i, 0) * region.width + t * (i % 3 === 0 ? 0.25 : 0.1)) % region.width);
    const y = Math.round(hash(seed, i, 1) * Math.max(2, region.height - 4)) + 1;
    writeCell(buffer, region, x, y, '·', dimColor(color, 0.7), currentBg(buffer, region, x, y));
  }
}

function drawReflections(buffer: CellBuffer, region: Region, startY: number, a: RGB, b: RGB, t: number): void {
  for (let y = startY; y < region.height; y++) {
    const wave = smoothPulse(t, y * 0.7, 3.2);
    const rowColor = lerpColor(a, b, y === startY ? 0 : (y - startY) / Math.max(1, region.height - startY));
    for (let x = 0; x < region.width; x++) {
      if ((x + y) % 2 !== 0) continue;
      const char = wave > 0.6 ? '~' : '·';
      writeCell(buffer, region, x, y, char, dimColor(rowColor, 0.65 + wave * 0.3), currentBg(buffer, region, x, y));
    }
  }
}

function drawRailing(buffer: CellBuffer, region: Region, y: number, color: RGB): void {
  for (let x = 0; x < region.width; x++) {
    writeCell(buffer, region, x, y, '─', color, currentBg(buffer, region, x, y));
    if (x % 6 === 0) {
      writeCell(buffer, region, x, Math.max(0, y - 1), '│', color, currentBg(buffer, region, x, Math.max(0, y - 1)));
    }
  }
}

function drawStringLights(buffer: CellBuffer, region: Region, y: number, color: RGB, t: number): void {
  for (let x = 2; x < region.width - 2; x++) {
    if (x % 4 === 0) {
      const pulse = smoothPulse(t, x * 0.3, 1.4);
      const bulb = lerpColor(dimColor(color, 0.45), color, pulse);
      writeCell(buffer, region, x, y, pulse > 0.82 ? '◉' : '•', bulb, currentBg(buffer, region, x, y));
    } else if (x % 2 === 0) {
      writeCell(buffer, region, x, y, '─', dimColor(color, 0.35), currentBg(buffer, region, x, y));
    }
  }
}

function drawAntenna(buffer: CellBuffer, region: Region, x: number, baseY: number, color: RGB): void {
  for (let y = Math.max(1, baseY - 5); y < baseY; y++) {
    writeCell(buffer, region, x, y, '│', color, currentBg(buffer, region, x, y));
  }
  writeCell(buffer, region, x, Math.max(1, baseY - 6), '┬', color, currentBg(buffer, region, x, Math.max(1, baseY - 6)));
}

function drawCanopy(buffer: CellBuffer, region: Region, topRows: number, color: RGB, seed: number): void {
  for (let y = 0; y < topRows; y++) {
    for (let x = 0; x < region.width; x++) {
      const density = y < 2 ? 0.48 : 0.56;
      if (hash(seed, x, y) < density && (x < region.width * 0.35 || x > region.width * 0.65 || y < 2)) {
        const char = hash(seed + 1, x, y) > 0.75 ? '▒' : '░';
        writeCell(buffer, region, x, y, char, color, currentBg(buffer, region, x, y));
      }
    }
  }
}

function drawBookshelves(buffer: CellBuffer, region: Region, color: RGB, accent: RGB): void {
  const shelfWidth = Math.max(4, Math.floor(region.width * 0.18));
  const sides = [0, region.width - shelfWidth];

  for (const startX of sides) {
    fillLocalRect(buffer, region, startX, 0, shelfWidth, region.height, color);
    for (let y = 1; y < region.height - 1; y += 3) {
      for (let x = startX + 1; x < startX + shelfWidth - 1; x++) {
        const bookColor = hash(83, x, y) > 0.55 ? accent : dimColor(accent, 0.7);
        writeCell(buffer, region, x, y, '▮', bookColor, color);
      }
    }
  }
}

function drawLamp(buffer: CellBuffer, region: Region, x: number, color: RGB): void {
  writeCell(buffer, region, x, 0, '│', dimColor(color, 0.5), currentBg(buffer, region, x, 0));
  if (region.height > 3) {
    writeCell(buffer, region, x, 1, '╭', color, currentBg(buffer, region, x, 1));
    writeCell(buffer, region, x + 1, 1, '─', color, currentBg(buffer, region, x + 1, 1));
    writeCell(buffer, region, x + 2, 1, '╮', color, currentBg(buffer, region, x + 2, 1));
    writeCell(buffer, region, x + 1, 2, '▼', color, currentBg(buffer, region, x + 1, 2));
  }
}

function drawPorchWindow(buffer: CellBuffer, region: Region, x: number, y: number, color: RGB): void {
  const bg = dimColor(color, 0.3);
  fillLocalRect(buffer, region, x, y, 5, 4, bg);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const border = row === 0 || row === 3 || col === 0 || col === 4;
      writeCell(buffer, region, x + col, y + row, border ? '│' : ' ', border ? dimColor(color, 0.55) : color, bg);
    }
  }
}

function renderCityFamily(
  buffer: CellBuffer,
  region: Region,
  theme: SceneTheme,
  t: number,
  variant: 'city' | 'balcony' | 'rooftop',
): void {
  const horizonRow = Math.max(3, Math.floor(region.height * (variant === 'city' ? 0.64 : 0.58)));
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  if (theme.moon) drawMoon(buffer, region, Math.max(5, Math.floor(region.width * 0.78)), Math.max(2, Math.floor(region.height * 0.18)), 1, theme.moon);
  drawStars(buffer, region, theme.glow, t, horizonRow - 2, variant === 'rooftop' ? 11 : 7);

  if (variant === 'balcony') {
    drawStringLights(buffer, region, 1, theme.accent, t);
  }

  drawSkyline(buffer, region, horizonRow, theme.silhouetteSoft, dimColor(theme.accentSoft, 0.8), 17, 2, Math.max(3, Math.floor(region.height * 0.22)), 0.85);
  drawSkyline(buffer, region, horizonRow + 1, theme.silhouette, theme.accent, 21, 3, Math.max(4, Math.floor(region.height * 0.36)), 1);

  if (variant === 'balcony') {
    drawRailing(buffer, region, Math.max(0, region.height - 2), theme.accentSoft);
  } else if (variant === 'rooftop') {
    fillLocalRect(buffer, region, 0, Math.max(0, region.height - 2), region.width, 2, theme.silhouette);
    drawAntenna(buffer, region, Math.max(2, Math.floor(region.width * 0.18)), Math.max(1, region.height - 2), theme.accentSoft);
  }
}

function renderAlley(buffer: CellBuffer, region: Region, theme: SceneTheme, t: number): void {
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  const sideWidth = Math.max(4, Math.floor(region.width * 0.16));
  fillLocalRect(buffer, region, 0, 0, sideWidth, region.height, theme.silhouette);
  fillLocalRect(buffer, region, region.width - sideWidth, 0, sideWidth, region.height, theme.silhouette);
  drawSkyline(buffer, region, Math.max(2, Math.floor(region.height * 0.78)), theme.silhouetteSoft, theme.accentSoft, 31, 2, Math.max(3, Math.floor(region.height * 0.22)), 0.9);

  const signY = Math.max(1, Math.floor(region.height * 0.22));
  fillLocalRect(buffer, region, 2, signY, Math.max(3, Math.floor(sideWidth * 0.7)), 2, dimColor(theme.accent, 0.22));
  fillLocalRect(buffer, region, region.width - sideWidth + 1, signY + 2, Math.max(3, Math.floor(sideWidth * 0.7)), 2, dimColor(theme.accentSoft, 0.22));
  writeCell(buffer, region, 3, signY + 1, '■', theme.accent, dimColor(theme.accent, 0.22));
  writeCell(buffer, region, region.width - sideWidth + 3, signY + 3, '■', theme.accentSoft, dimColor(theme.accentSoft, 0.22));

  drawRain(buffer, region, theme.glow, t, 37);
  drawReflections(buffer, region, Math.max(0, region.height - 4), theme.accent, theme.accentSoft, t);
}

function renderTreehouse(buffer: CellBuffer, region: Region, theme: SceneTheme, t: number): void {
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  if (theme.moon) drawMoon(buffer, region, Math.max(4, Math.floor(region.width * 0.72)), Math.max(2, Math.floor(region.height * 0.16)), 1, theme.moon);
  drawCanopy(buffer, region, Math.max(2, Math.floor(region.height * 0.28)), theme.silhouetteSoft, 41);
  fillLocalRect(buffer, region, 0, Math.max(0, region.height - 5), 2, 5, theme.silhouette);
  fillLocalRect(buffer, region, region.width - 2, Math.max(1, region.height - 6), 2, 6, theme.silhouette);
  fillLocalRect(buffer, region, Math.max(2, Math.floor(region.width * 0.38)), Math.max(1, Math.floor(region.height * 0.35)), 6, 4, theme.silhouette);
  drawPorchWindow(buffer, region, Math.max(3, Math.floor(region.width * 0.39)), Math.max(1, Math.floor(region.height * 0.36)), theme.accent);
  drawFireflies(buffer, region, theme.accentSoft, t, 43, Math.max(2, region.height - 2));
}

function renderPark(buffer: CellBuffer, region: Region, theme: SceneTheme, t: number): void {
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  if (theme.moon) drawMoon(buffer, region, Math.max(4, Math.floor(region.width * 0.18)), Math.max(2, Math.floor(region.height * 0.16)), 1, theme.moon);
  const baseY = Math.max(2, Math.floor(region.height * 0.72));
  drawSkyline(buffer, region, baseY, theme.silhouetteSoft, theme.accentSoft, 53, 2, Math.max(2, Math.floor(region.height * 0.18)), 1.35);
  fillLocalRect(buffer, region, 0, baseY, region.width, Math.max(1, region.height - baseY), theme.silhouette);

  for (let x = 4; x < region.width; x += 8) {
    const trunkHeight = 2 + Math.floor(hash(59, x, 0) * 2);
    for (let y = baseY - trunkHeight; y < baseY; y++) {
      writeCell(buffer, region, x, y, '│', dimColor(theme.accent, 0.5), currentBg(buffer, region, x, y));
    }
    writeCell(buffer, region, x, baseY - trunkHeight - 1, '▲', theme.accentSoft, currentBg(buffer, region, x, baseY - trunkHeight - 1));
  }

  drawFireflies(buffer, region, theme.glow, t, 61, baseY);
}

function renderPorch(buffer: CellBuffer, region: Region, theme: SceneTheme, t: number): void {
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  if (theme.moon) drawMoon(buffer, region, Math.max(4, Math.floor(region.width * 0.72)), Math.max(2, Math.floor(region.height * 0.16)), 1, theme.moon);
  fillLocalRect(buffer, region, 0, Math.max(0, region.height - 6), Math.max(7, Math.floor(region.width * 0.34)), 6, theme.silhouetteSoft);
  drawPorchWindow(buffer, region, 2, Math.max(1, region.height - 5), theme.accent);
  drawRailing(buffer, region, Math.max(0, region.height - 2), theme.accentSoft);
  drawSnow(buffer, region, theme.glow, t, 71);
}

function renderBookshop(buffer: CellBuffer, region: Region, theme: SceneTheme, t: number): void {
  fillGradient(buffer, region, theme.skyTop, theme.skyBottom);
  drawBookshelves(buffer, region, theme.silhouetteSoft, theme.accentSoft);
  drawLamp(buffer, region, Math.max(1, Math.floor(region.width / 2) - 1), theme.glow);
  fillLocalRect(buffer, region, Math.max(3, Math.floor(region.width * 0.36)), Math.max(1, Math.floor(region.height * 0.35)), Math.max(8, Math.floor(region.width * 0.28)), Math.max(4, region.height - Math.max(2, Math.floor(region.height * 0.35)) - 2), theme.silhouette);
  drawDust(buffer, region, theme.glow, t, 89);
}

export class ProceduralScene implements Scene {
  private width = 0;
  private height = 0;
  private theme: SceneTheme;

  constructor(theme: SceneTheme) {
    this.theme = theme;
  }

  init(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  render(buffer: CellBuffer, region: Region): void {
    const t = Date.now() / 1000;
    const localRegion = { ...region, width: this.width || region.width, height: this.height || region.height };

    switch (this.theme.mode) {
      case 'city':
        renderCityFamily(buffer, localRegion, this.theme, t, 'city');
        break;
      case 'balcony':
        renderCityFamily(buffer, localRegion, this.theme, t, 'balcony');
        break;
      case 'rooftop':
        renderCityFamily(buffer, localRegion, this.theme, t, 'rooftop');
        break;
      case 'alley':
        renderAlley(buffer, localRegion, this.theme, t);
        break;
      case 'treehouse':
        renderTreehouse(buffer, localRegion, this.theme, t);
        break;
      case 'park':
        renderPark(buffer, localRegion, this.theme, t);
        break;
      case 'porch':
        renderPorch(buffer, localRegion, this.theme, t);
        break;
      case 'bookshop':
        renderBookshop(buffer, localRegion, this.theme, t);
        break;
    }
  }
}

export function createProceduralScene(name: string): Scene {
  const sceneName = PROCEDURAL_SCENE_NAMES.includes(name as SceneName) ? (name as SceneName) : 'city';
  return new ProceduralScene(THEMES[sceneName]);
}
