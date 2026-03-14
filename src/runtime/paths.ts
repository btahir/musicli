import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_DIR = dirname(fileURLToPath(import.meta.url));

function resolveAssetRoot(): string {
  const candidates = [
    join(RUNTIME_DIR, '..'),
    join(RUNTIME_DIR, '..', '..'),
  ];

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, 'assets', 'scenes')) &&
      existsSync(join(candidate, 'sounds')) &&
      (existsSync(join(candidate, 'tracks')) || existsSync(join(candidate, 'library')))
    ) {
      return candidate;
    }
  }

  return candidates[0];
}

export const ASSET_ROOT = resolveAssetRoot();
export const TRACKS_DIR = join(ASSET_ROOT, 'tracks');
export const SOUNDS_DIR = join(ASSET_ROOT, 'sounds');
export const SCENES_DIR = join(ASSET_ROOT, 'assets', 'scenes');
