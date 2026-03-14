import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUNDLED_LIBRARY_CATALOG_PATH,
  BUNDLED_LIBRARY_DIR,
  INSTALLED_LIBRARY_CATALOG_PATH,
  INSTALLED_LIBRARY_STATE_PATH,
  LIBRARY_HOME,
} from './paths.js';
import type {
  InstalledLibraryState,
  RuntimeLibraryCatalog,
  RuntimeTrack,
  TrackCatalog,
  TrackCatalogEntry,
} from './types.js';

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function withRuntimePaths(rootDir: string, catalog: TrackCatalog, source: 'bundled' | 'installed'): RuntimeLibraryCatalog {
  return {
    ...catalog,
    source,
    rootDir,
    tracks: catalog.tracks.map((track): RuntimeTrack => ({
      ...track,
      filePath: join(rootDir, track.file),
    })),
  };
}

export function loadInstalledLibraryState(): InstalledLibraryState | null {
  if (!existsSync(INSTALLED_LIBRARY_STATE_PATH)) return null;
  return readJsonFile<InstalledLibraryState>(INSTALLED_LIBRARY_STATE_PATH);
}

export function loadBundledTrackCatalog(): RuntimeLibraryCatalog {
  if (!existsSync(BUNDLED_LIBRARY_CATALOG_PATH)) {
    return {
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      sourceDirectory: 'tracks',
      trackCount: 0,
      fileCount: 0,
      categories: [],
      tracks: [],
      source: 'bundled',
      rootDir: BUNDLED_LIBRARY_DIR,
    };
  }

  return withRuntimePaths(
    BUNDLED_LIBRARY_DIR,
    readJsonFile<TrackCatalog>(BUNDLED_LIBRARY_CATALOG_PATH),
    'bundled',
  );
}

export function loadInstalledTrackCatalog(): RuntimeLibraryCatalog | null {
  if (!existsSync(INSTALLED_LIBRARY_CATALOG_PATH)) return null;

  return withRuntimePaths(
    LIBRARY_HOME,
    readJsonFile<TrackCatalog>(INSTALLED_LIBRARY_CATALOG_PATH),
    'installed',
  );
}

export function loadActiveTrackCatalog(): RuntimeLibraryCatalog {
  return loadInstalledTrackCatalog() ?? loadBundledTrackCatalog();
}

export function findTrackBySlug(tracks: RuntimeTrack[], slug: string): RuntimeTrack | undefined {
  return tracks.find((track) => track.slug === slug);
}

export function findTrackEntryByFile(entries: TrackCatalogEntry[], file: string): TrackCatalogEntry | undefined {
  return entries.find((entry) => entry.file === file);
}
