import { execFileSync } from 'node:child_process';
import { checkYtDlp } from '../utils/check-deps.js';

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
export const YT_DLP_FORMAT_SELECTOR = 'ba/bestaudio/best';

export function buildYouTubeStreamArgs(url: string): string[] {
  return ['--no-playlist', '-g', '-f', YT_DLP_FORMAT_SELECTOR, url];
}

export function isYouTubeUrl(url: string): boolean {
  return YT_REGEX.test(url);
}

export function getYouTubeStreamUrl(url: string): string {
  if (!checkYtDlp()) {
    throw new Error('yt-dlp is required for YouTube URLs. Install it and try again.');
  }

  try {
    const streamUrl = execFileSync('yt-dlp', buildYouTubeStreamArgs(url), {
      encoding: 'utf-8',
      timeout: 15000,
    }).trim();
    const resolved = streamUrl.split('\n').find(Boolean);
    if (!resolved) throw new Error('yt-dlp returned an empty stream URL');
    return resolved;
  } catch {
    throw new Error('Failed to extract a playable stream from this YouTube URL. Update yt-dlp and try again.');
  }
}
