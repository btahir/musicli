import type { RuntimeTrack } from './types.js';

export interface TrackSearchScope {
  id: string;
  label: string;
  category?: string;
}

export interface TrackSearchResult {
  track: RuntimeTrack;
  score: number;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function fuzzySequenceScore(text: string, query: string): number {
  if (!query) return 0;

  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] !== query[queryIndex]) continue;
    if (firstMatch === -1) firstMatch = i;
    lastMatch = i;
    queryIndex += 1;
  }

  if (queryIndex !== query.length || firstMatch === -1 || lastMatch === -1) {
    return 0;
  }

  const span = lastMatch - firstMatch + 1;
  return Math.max(0, 180 - span - firstMatch * 2);
}

function scoreTrack(track: RuntimeTrack, query: string, currentTrack: RuntimeTrack | null): number {
  const title = normalizeSearchText(track.title);
  const category = normalizeSearchText(track.categoryLabel || track.category);

  if (!query) {
    let score = 100;
    if (currentTrack?.slug === track.slug) score += 300;
    if (currentTrack?.category === track.category) score += 120;
    return score;
  }

  let score = 0;

  if (title === query) score = Math.max(score, 1000);
  if (title.startsWith(query)) score = Math.max(score, 920 - Math.min(title.length, 80));

  const titleWords = title.split(' ');
  const wordPrefixIndex = titleWords.findIndex((word) => word.startsWith(query));
  if (wordPrefixIndex >= 0) score = Math.max(score, 840 - wordPrefixIndex * 8);

  const titleIndex = title.indexOf(query);
  if (titleIndex >= 0) score = Math.max(score, 760 - titleIndex * 4);

  if (category === query) score = Math.max(score, 740);
  if (category.startsWith(query)) score = Math.max(score, 700);
  if (category.includes(query)) score = Math.max(score, 640);

  const fuzzy = fuzzySequenceScore(title, query);
  if (fuzzy > 0) score = Math.max(score, 420 + fuzzy);

  return score;
}

export function buildTrackSearchScopes(tracks: RuntimeTrack[]): TrackSearchScope[] {
  const scopes: TrackSearchScope[] = [{ id: 'all', label: 'All tracks' }];
  const seen = new Set<string>();

  for (const track of tracks) {
    if (seen.has(track.category)) continue;
    seen.add(track.category);
    scopes.push({
      id: track.category,
      label: track.categoryLabel,
      category: track.category,
    });
  }

  return scopes;
}

export function searchTracks(
  tracks: RuntimeTrack[],
  query: string,
  scope: TrackSearchScope,
  currentTrack: RuntimeTrack | null = null,
): TrackSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  return tracks
    .filter((track) => !scope.category || track.category === scope.category)
    .map((track) => ({
      track,
      score: scoreTrack(track, normalizedQuery, currentTrack),
    }))
    .filter((result) => !normalizedQuery || result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.title.localeCompare(b.track.title);
    });
}
