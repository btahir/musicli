import { readdirSync, renameSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRACKS_DIR = join(ROOT, 'tracks');

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseLegacyVariant(name) {
  const match = name.match(/^(.*)-\((\d+)\)$/);
  if (!match) return { baseName: name, variant: null };
  return { baseName: match[1], variant: Number(match[2]) };
}

function listTrackFiles(dir = TRACKS_DIR, relativeDir = '') {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = [];

  for (const entry of entries) {
    if (entry.name === 'by-category') continue;
    if (entry.isDirectory()) {
      const childRelativeDir = relativeDir ? join(relativeDir, entry.name) : entry.name;
      files.push(...listTrackFiles(join(dir, entry.name), childRelativeDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.mp3')) {
      files.push(relativeDir ? join(relativeDir, entry.name) : entry.name);
    }
  }

  return files;
}

const files = listTrackFiles();
const renamePlan = [];
const seenTargets = new Set();

for (const file of files) {
  const { name, ext } = parse(file);
  const { baseName, variant } = parseLegacyVariant(name);
  const normalizedBase = slugify(baseName);
  const normalizedFileName = variant ? `${normalizedBase}-v${variant}${ext}` : `${normalizedBase}${ext}`;
  const nextName = dirname(file) === '.'
    ? normalizedFileName
    : join(dirname(file), normalizedFileName);

  if (seenTargets.has(nextName)) {
    throw new Error(`Filename collision while normalizing: ${nextName}`);
  }
  seenTargets.add(nextName);

  if (nextName !== file) {
    renamePlan.push({ from: file, to: nextName });
  }
}

for (const step of renamePlan) {
  renameSync(join(TRACKS_DIR, step.from), join(TRACKS_DIR, step.to));
}

console.log(`Renamed ${renamePlan.length} files in ${TRACKS_DIR}`);
