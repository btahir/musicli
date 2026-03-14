import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SAVED_CHANNELS_PATH } from './paths.js';

export interface SavedChannel {
  slug: string;
  label: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentStream {
  input: string;
  label: string;
  updatedAt: string;
}

export interface LocalFolderSource {
  slug: string;
  label: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedChannelStore {
  schemaVersion: 2;
  updatedAt: string;
  channels: SavedChannel[];
  recentStreams: RecentStream[];
  localFolders: LocalFolderSource[];
}

export interface ChannelStore {
  channels: SavedChannel[];
  recentStreams: RecentStream[];
  localFolders: LocalFolderSource[];
}

const MAX_RECENT_STREAMS = 8;

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tempPath, path);
}

function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeChannelSlug(value: string): string {
  const cleaned = cleanLabel(value)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'channel';
}

export function parseSavedChannelInput(input: string): { label: string; url: string } | null {
  const splitAt = input.indexOf('=');
  if (splitAt <= 0) return null;

  const label = cleanLabel(input.slice(0, splitAt));
  const url = input.slice(splitAt + 1).trim();
  if (!label || !/^https?:\/\//i.test(url)) return null;

  return { label, url };
}

export function loadSavedChannels(): SavedChannel[] {
  return loadChannelStore().channels;
}

export function loadChannelStore(): ChannelStore {
  if (!existsSync(SAVED_CHANNELS_PATH)) {
    return { channels: [], recentStreams: [], localFolders: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(SAVED_CHANNELS_PATH, 'utf8')) as Partial<SavedChannelStore>;
    const channels = Array.isArray(parsed.channels) ? parsed.channels : [];
    const recentStreams = Array.isArray(parsed.recentStreams) ? parsed.recentStreams : [];
    const localFolders = Array.isArray(parsed.localFolders) ? parsed.localFolders : [];

    return {
      channels: channels
        .filter((entry): entry is SavedChannel =>
          Boolean(entry && typeof entry.slug === 'string' && typeof entry.label === 'string' && typeof entry.url === 'string'),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
      recentStreams: recentStreams
        .filter((entry): entry is RecentStream =>
          Boolean(entry && typeof entry.input === 'string' && typeof entry.label === 'string'),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      localFolders: localFolders
        .filter((entry): entry is LocalFolderSource =>
          Boolean(entry && typeof entry.slug === 'string' && typeof entry.label === 'string' && typeof entry.path === 'string'),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  } catch {
    return { channels: [], recentStreams: [], localFolders: [] };
  }
}

export function saveSavedChannels(channels: SavedChannel[]): void {
  const store = loadChannelStore();
  saveChannelStore({ channels, recentStreams: store.recentStreams, localFolders: store.localFolders });
}

export function saveChannelStore(store: ChannelStore): void {
  writeJsonAtomic(SAVED_CHANNELS_PATH, {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    channels: store.channels,
    recentStreams: store.recentStreams,
    localFolders: store.localFolders,
  } satisfies SavedChannelStore);
}

export function findSavedChannel(channels: SavedChannel[], query: string): SavedChannel | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const slug = normalizeChannelSlug(trimmed);
  const lowered = trimmed.toLowerCase();

  return channels.find((channel) => channel.slug === slug || channel.label.toLowerCase() === lowered);
}

export function upsertSavedChannel(
  channels: SavedChannel[],
  label: string,
  url: string,
  now = new Date().toISOString(),
): { channels: SavedChannel[]; channel: SavedChannel } {
  const normalizedLabel = cleanLabel(label);
  const slug = normalizeChannelSlug(normalizedLabel);
  const existing = channels.find((channel) => channel.slug === slug);

  const channel: SavedChannel = existing
    ? { ...existing, label: normalizedLabel, url, updatedAt: now }
    : { slug, label: normalizedLabel, url, createdAt: now, updatedAt: now };

  const nextChannels = existing
    ? channels.map((entry) => (entry.slug === slug ? channel : entry))
    : [...channels, channel];

  nextChannels.sort((a, b) => a.label.localeCompare(b.label));

  return { channels: nextChannels, channel };
}

export function upsertRecentStream(
  recentStreams: RecentStream[],
  input: string,
  label: string,
  now = new Date().toISOString(),
): RecentStream[] {
  const normalizedInput = input.trim();
  const normalizedLabel = cleanLabel(label) || normalizedInput;
  const next = recentStreams.filter((entry) => entry.input !== normalizedInput);

  next.unshift({
    input: normalizedInput,
    label: normalizedLabel,
    updatedAt: now,
  });

  return next.slice(0, MAX_RECENT_STREAMS);
}

export function findLocalFolder(
  localFolders: LocalFolderSource[],
  query: string,
): LocalFolderSource | undefined {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const slug = normalizeChannelSlug(trimmed);
  const lowered = trimmed.toLowerCase();

  return localFolders.find((folder) =>
    folder.slug === slug
    || folder.label.toLowerCase() === lowered
    || folder.path === trimmed,
  );
}

export function upsertLocalFolder(
  localFolders: LocalFolderSource[],
  label: string,
  path: string,
  now = new Date().toISOString(),
): { localFolders: LocalFolderSource[]; folder: LocalFolderSource } {
  const normalizedLabel = cleanLabel(label);
  const normalizedPath = path.trim();
  const slug = normalizeChannelSlug(normalizedLabel);
  const existing = localFolders.find((folder) => folder.slug === slug || folder.path === normalizedPath);

  const folder: LocalFolderSource = existing
    ? {
        ...existing,
        label: normalizedLabel,
        path: normalizedPath,
        slug,
        updatedAt: now,
      }
    : {
        slug,
        label: normalizedLabel,
        path: normalizedPath,
        createdAt: now,
        updatedAt: now,
      };

  const nextFolders = existing
    ? localFolders.map((entry) => (entry.slug === existing.slug ? folder : entry))
    : [...localFolders, folder];

  nextFolders.sort((a, b) => a.label.localeCompare(b.label));

  return { localFolders: nextFolders, folder };
}
