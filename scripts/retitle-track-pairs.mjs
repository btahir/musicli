import { readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALTERNATE_TRACK_TITLES, assertUniqueAlternateTitles } from './track-alternate-titles.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRACKS_DIR = join(ROOT, 'tracks');

assertUniqueAlternateTitles();

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

const existingFiles = new Set(listTrackFiles());
const renamePlan = [];
const problems = [];

for (const [baseSlug, alternateSlug] of Object.entries(ALTERNATE_TRACK_TITLES)) {
  const primarySource = [...existingFiles].find((file) => file.endsWith(`/${baseSlug}-v1.mp3`) || file === `${baseSlug}-v1.mp3`);
  const primaryTarget = primarySource?.replace(`${baseSlug}-v1.mp3`, `${baseSlug}.mp3`);
  const alternateSource = [...existingFiles].find((file) => file.endsWith(`/${baseSlug}-v2.mp3`) || file === `${baseSlug}-v2.mp3`);
  const alternateTarget = alternateSource?.replace(`${baseSlug}-v2.mp3`, `${alternateSlug}.mp3`);

  if (primarySource && primaryTarget) {
    if (existingFiles.has(primaryTarget)) {
      problems.push(`Cannot rename ${primarySource} -> ${primaryTarget}; target already exists.`);
    } else {
      renamePlan.push({ from: primarySource, to: primaryTarget });
      existingFiles.delete(primarySource);
      existingFiles.add(primaryTarget);
    }
  } else if (![...existingFiles].some((file) => file.endsWith(`/${baseSlug}.mp3`) || file === `${baseSlug}.mp3`)) {
    problems.push(`Missing primary track for ${baseSlug}. Expected ${baseSlug}-v1.mp3 or ${baseSlug}.mp3.`);
  }

  if (alternateSource && alternateTarget) {
    if (existingFiles.has(alternateTarget)) {
      problems.push(`Cannot rename ${alternateSource} -> ${alternateTarget}; target already exists.`);
    } else {
      renamePlan.push({ from: alternateSource, to: alternateTarget });
      existingFiles.delete(alternateSource);
      existingFiles.add(alternateTarget);
    }
  } else if (![...existingFiles].some((file) => file.endsWith(`/${alternateSlug}.mp3`) || file === `${alternateSlug}.mp3`)) {
    problems.push(`Missing alternate track for ${baseSlug}. Expected ${baseSlug}-v2.mp3 or ${alternateSlug}.mp3.`);
  }
}

if (problems.length) {
  throw new Error(problems.join('\n'));
}

for (const step of renamePlan) {
  renameSync(join(TRACKS_DIR, step.from), join(TRACKS_DIR, step.to));
}

console.log(`Retitled ${renamePlan.length} files in ${TRACKS_DIR}`);
