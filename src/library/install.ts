import { createHash } from 'node:crypto';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LIBRARY_SOURCE_PATH, LIBRARY_HOME } from './paths.js';
import type {
  InstallPackOptions,
  InstallPackResult,
  InstalledLibraryState,
  LibraryPackManifest,
  LibraryRepositoryManifest,
  TrackCatalog,
} from './types.js';

interface LoadedRepository {
  source: string;
  manifest: LibraryRepositoryManifest;
}

interface LoadedPack {
  source: string;
  manifest: LibraryPackManifest;
}

function isHttpSpecifier(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isFileSpecifier(value: string): boolean {
  return value.startsWith('file://');
}

function toLocalPath(specifier: string): string {
  return isFileSpecifier(specifier) ? fileURLToPath(specifier) : specifier;
}

function isDirectorySpecifier(specifier: string): boolean {
  if (specifier.endsWith('/')) return true;
  if (isHttpSpecifier(specifier)) return false;

  try {
    return existsSync(toLocalPath(specifier)) && statSync(toLocalPath(specifier)).isDirectory();
  } catch {
    return false;
  }
}

function normalizeRepositorySource(source?: string): string {
  if (!source) {
    if (!DEFAULT_LIBRARY_SOURCE_PATH) {
      throw new Error('No default library source is configured. Pass --source <repository.json>.');
    }
    source = DEFAULT_LIBRARY_SOURCE_PATH;
  }

  if (isHttpSpecifier(source) || isFileSpecifier(source)) {
    return source.endsWith('/') ? new URL('repository.json', source).toString() : source;
  }

  if (existsSync(source) && statSync(source).isDirectory()) {
    const repositoryJson = join(source, 'repository.json');
    const localRepositoryJson = join(source, 'repository.local.json');

    if (existsSync(repositoryJson)) return repositoryJson;
    if (existsSync(localRepositoryJson)) return localRepositoryJson;
    return repositoryJson;
  }

  return source;
}

function resolveSpecifier(base: string, ref: string): string {
  if (isHttpSpecifier(ref) || isFileSpecifier(ref) || isAbsolute(ref)) {
    return ref;
  }

  if (isHttpSpecifier(base) || isFileSpecifier(base)) {
    const resolvedBase = isDirectorySpecifier(base) && !base.endsWith('/') ? `${base}/` : base;
    return new URL(ref, resolvedBase).toString();
  }

  return join(isDirectorySpecifier(base) ? base : dirname(base), ref);
}

async function readTextFromSpecifier(specifier: string): Promise<string> {
  if (isHttpSpecifier(specifier)) {
    const response = await fetch(specifier);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${specifier}: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  return readFileSync(toLocalPath(specifier), 'utf8');
}

async function readJsonFromSpecifier<T>(specifier: string): Promise<T> {
  return JSON.parse(await readTextFromSpecifier(specifier)) as T;
}

function sha256File(path: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

async function copyOrDownloadFile(source: string, destination: string): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true });
  const tempPath = `${destination}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    if (isHttpSpecifier(source)) {
      const response = await fetch(source);
      if (!response.ok || !response.body) {
        throw new Error(`Failed to download ${source}: ${response.status} ${response.statusText}`);
      }

      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        createWriteStream(tempPath),
      );
    } else {
      copyFileSync(toLocalPath(source), tempPath);
    }

    renameSync(tempPath, destination);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempPath, path);
}

function buildInstalledCatalog(libraryRoot: string, sourceCatalog: TrackCatalog): TrackCatalog {
  const tracks = sourceCatalog.tracks.filter((track) => existsSync(join(libraryRoot, track.file)));
  const trackCountByCategory = new Map<string, number>();

  for (const track of tracks) {
    trackCountByCategory.set(track.category, (trackCountByCategory.get(track.category) || 0) + 1);
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDirectory: 'tracks',
    trackCount: tracks.length,
    fileCount: tracks.length,
    categories: sourceCatalog.categories
      .map((category) => ({
        ...category,
        trackCount: trackCountByCategory.get(category.slug) || 0,
      }))
      .filter((category) => category.trackCount > 0),
    tracks,
  };
}

export async function loadLibraryRepositoryManifest(source?: string): Promise<LoadedRepository> {
  const normalizedSource = normalizeRepositorySource(source);
  const manifest = await readJsonFromSpecifier<LibraryRepositoryManifest>(normalizedSource);
  return { source: normalizedSource, manifest };
}

export async function loadLibraryPackManifest(repository: LoadedRepository, pack: string): Promise<LoadedPack> {
  const packRef = repository.manifest.packs[pack];

  if (!packRef) {
    const available = Object.keys(repository.manifest.packs).sort();
    throw new Error(`Unknown pack "${pack}". Available packs: ${available.join(', ')}`);
  }

  const source = resolveSpecifier(repository.source, packRef.manifest);
  const manifest = await readJsonFromSpecifier<LibraryPackManifest>(source);

  return { source, manifest };
}

export async function installPack(options: InstallPackOptions): Promise<InstallPackResult> {
  const repository = await loadLibraryRepositoryManifest(options.source);
  const pack = await loadLibraryPackManifest(repository, options.pack);
  const sourceCatalog = await readJsonFromSpecifier<TrackCatalog>(
    resolveSpecifier(repository.source, repository.manifest.catalog),
  );
  const contentBase = resolveSpecifier(repository.source, repository.manifest.contentBase);
  const libraryRoot = options.targetRoot || LIBRARY_HOME;

  let copied = 0;
  let skipped = 0;

  for (const track of pack.manifest.tracks) {
    const destination = join(libraryRoot, track.file);

    if (!options.force && existsSync(destination)) {
      const sizeMatches = track.sizeBytes === undefined || statSync(destination).size === track.sizeBytes;
      const hashMatches = track.sha256 === undefined || sha256File(destination) === track.sha256;

      if (sizeMatches && hashMatches) {
        skipped += 1;
        continue;
      }
    }

    await copyOrDownloadFile(resolveSpecifier(contentBase, track.file), destination);

    if (track.sha256 && sha256File(destination) !== track.sha256) {
      rmSync(destination, { force: true });
      throw new Error(`Checksum mismatch while installing ${track.file}`);
    }

    copied += 1;
  }

  const installedCatalog = buildInstalledCatalog(libraryRoot, sourceCatalog);
  const installedState: InstalledLibraryState = {
    schemaVersion: 1,
    installedAt: new Date().toISOString(),
    repositoryId: repository.manifest.id,
    repositoryTitle: repository.manifest.title,
    repositoryVersion: repository.manifest.version,
    lastInstalledPack: pack.manifest.pack,
    trackCount: installedCatalog.trackCount,
  };

  writeJsonAtomic(join(libraryRoot, 'catalog.json'), installedCatalog);
  writeJsonAtomic(join(libraryRoot, 'installed.json'), installedState);

  return {
    libraryRoot,
    repositoryId: repository.manifest.id,
    repositoryTitle: repository.manifest.title,
    repositoryVersion: repository.manifest.version,
    pack: pack.manifest.pack,
    copied,
    skipped,
    total: pack.manifest.trackCount,
    trackCount: installedCatalog.trackCount,
  };
}
