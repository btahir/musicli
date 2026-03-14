import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import type { LibraryCategory, RuntimeLibraryCatalog, RuntimeTrack, TrackCatalogEntry } from './types.js';

const AUDIO_EXTENSIONS = new Set([
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.ogg',
  '.opus',
  '.wav',
]);

function normalizePathSegment(value: string): string {
  return value
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function titleCase(value: string): string {
  return normalizePathSegment(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0] ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function slugify(value: string): string {
  return normalizePathSegment(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function walkAudioFiles(root: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      results.push(fullPath);
    }
  }

  walk(root);
  results.sort((a, b) => a.localeCompare(b));
  return results;
}

function buildTrackEntry(root: string, filePath: string, rootLabel: string): TrackCatalogEntry {
  const rel = relative(root, filePath);
  const relParts = rel.split(sep).filter(Boolean);
  const fileName = relParts[relParts.length - 1] ?? basename(filePath);
  const firstDir = relParts.length > 1 ? relParts[0] : rootLabel;
  const category = slugify(firstDir) || 'local-folder';
  const categoryLabel = titleCase(firstDir) || titleCase(rootLabel);
  const title = titleCase(fileName) || basename(fileName, extname(fileName));
  const slugBase = slugify(rel.replaceAll(sep, '-')) || slugify(fileName) || 'track';

  return {
    title,
    slug: slugBase,
    category,
    categoryLabel,
    file: rel,
  };
}

export function loadLocalFolderCatalog(folderPath: string, label?: string): RuntimeLibraryCatalog {
  const normalizedRoot = folderPath.trim();
  if (!normalizedRoot) {
    throw new Error('Choose a local folder first.');
  }

  if (!existsSync(normalizedRoot) || !statSync(normalizedRoot).isDirectory()) {
    throw new Error(`Local folder not found: ${normalizedRoot}`);
  }

  const rootLabel = label?.trim() || basename(normalizedRoot);
  const audioFiles = walkAudioFiles(normalizedRoot);
  if (!audioFiles.length) {
    throw new Error(`No supported audio files were found in ${normalizedRoot}`);
  }

  const tracks = audioFiles.map((filePath) => buildTrackEntry(normalizedRoot, filePath, rootLabel));
  const trackCountByCategory = new Map<string, number>();
  const categoryLabels = new Map<string, string>();

  for (const track of tracks) {
    trackCountByCategory.set(track.category, (trackCountByCategory.get(track.category) || 0) + 1);
    categoryLabels.set(track.category, track.categoryLabel);
  }

  const categories: LibraryCategory[] = [...trackCountByCategory.entries()]
    .map(([slug, trackCount]) => ({
      slug,
      label: categoryLabels.get(slug) || titleCase(slug),
      description: `Tracks from ${rootLabel}`,
      trackCount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDirectory: normalizedRoot,
    trackCount: tracks.length,
    fileCount: tracks.length,
    categories,
    tracks: tracks.map((track): RuntimeTrack => ({
      ...track,
      filePath: join(normalizedRoot, track.file),
    })),
    source: 'local',
    rootDir: normalizedRoot,
  };
}
