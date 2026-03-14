import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { ALTERNATE_TRACK_TITLES, assertUniqueAlternateTitles } from './track-alternate-titles.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const TRACKS_DIR = join(ROOT, 'tracks');
const CATALOG_PATH = join(TRACKS_DIR, 'catalog.json');

const CATEGORY_DEFS = {
  chillhop: {
    label: 'Chillhop & Cozy Beats',
    description: 'Warm keys, city walks, golden-hour grooves, and mellow head-nodders.',
  },
  jazzhop: {
    label: 'Jazz Lounge & Bookstore Grooves',
    description: 'Brushes, upright bass, late-night tables, bookstores, and smoky corners.',
  },
  'ambient-lofi': {
    label: 'Ambient Drift & Dreamscapes',
    description: 'Clouds, fog, underwater textures, cosmic loops, and meditative quiet.',
  },
  'soul-rnb': {
    label: 'Soul, Slow Jams & Warm Rooms',
    description: 'Romance, nostalgia, intimate rooms, slow dances, and after-hours reflection.',
  },
  'asian-lofi': {
    label: 'Asian & Zen Lo-Fi',
    description: 'Temple dawns, bamboo moonlight, lantern streets, and tea-house calm.',
  },
  'funk-soul': {
    label: 'Funk, Soul & Retro Bounce',
    description: 'Block parties, jukebox glow, roller rinks, basement grooves, and family warmth.',
  },
  'seasonal-weather': {
    label: 'Seasons, Rain & Weather',
    description: 'Spring blooms, winter hush, storms, sidewalk puddles, coastlines, and outdoor air.',
  },
  'late-night': {
    label: 'Late Night, Neon & After Hours',
    description: '3 AM loops, neon reflections, rooftops, last calls, trains, and empty streets.',
  },
  activities: {
    label: 'Focus, Rituals & Daily Routines',
    description: 'Study, coding, reading, cooking, painting, yoga, journaling, and mindful routines.',
  },
  hybrid: {
    label: 'Hybrid, World & Cinematic',
    description: 'Bossa, synthwave, afrobeat, tropical sketches, and credits-roll atmospheres.',
  },
};

const RAW_TRACK_CLASSIFICATION = {
  '2-AM-Debug-Loop': { category: 'activities', subcategory: 'coding' },
  '3-AM-Echoes': { category: 'late-night', subcategory: '3am' },
  '3AM-Sink-Light': { category: 'soul-rnb', subcategory: 'heartbreak' },
  'A-Taste-Of-Spring': { category: 'seasonal-weather', subcategory: 'spring' },
  'Ashes-in-the-Coffee-Cup': { category: 'jazzhop', subcategory: 'after-hours' },
  'Aurora-on-Mute': { category: 'ambient-lofi', subcategory: 'cosmic' },
  'Autumn-On-The-Window-Glass': { category: 'seasonal-weather', subcategory: 'autumn' },
  'Barefoot-in-the-Kitchen': { category: 'soul-rnb', subcategory: 'home' },
  'Basement-Groove-86': { category: 'funk-soul', subcategory: 'basement' },
  'Block-Party-Slow-Jam': { category: 'funk-soul', subcategory: 'block-party' },
  'Breezy-Afternoon-Terrace': { category: 'jazzhop', subcategory: 'terrace' },
  'Café-da-Tarde': { category: 'hybrid', subcategory: 'bossa' },
  'Candle-Wax-Heart': { category: 'soul-rnb', subcategory: 'romance' },
  'Candlelit-at-70-BPM': { category: 'jazzhop', subcategory: 'candlelit' },
  'Cathedral-Hiss': { category: 'ambient-lofi', subcategory: 'cathedral' },
  'Deep-Space-Loop': { category: 'ambient-lofi', subcategory: 'cosmic' },
  'Dog-Eared-Pages': { category: 'activities', subcategory: 'reading' },
  'Drifting-Through-Fog': { category: 'ambient-lofi', subcategory: 'fog' },
  'Dust-In-The-Curtains': { category: 'activities', subcategory: 'home' },
  'Dust-On-The-Needle': { category: 'funk-soul', subcategory: 'vintage' },
  'Dust-on-the-Morning-Keys': { category: 'chillhop', subcategory: 'morning' },
  'Dusty-Jukebox-Heart': { category: 'funk-soul', subcategory: 'jukebox' },
  'Faded-Corners-Of-The-Page': { category: 'activities', subcategory: 'reading' },
  'Fallen-Leaves-Loop': { category: 'seasonal-weather', subcategory: 'autumn' },
  'Fireplace-Loop': { category: 'seasonal-weather', subcategory: 'winter' },
  'Glasshouse-Ghosts': { category: 'ambient-lofi', subcategory: 'greenhouse' },
  'Golden-Afternoon-Groove': { category: 'soul-rnb', subcategory: 'groove' },
  'Grandmas-Kitchen-on-Sunday': { category: 'funk-soul', subcategory: 'family' },
  'Graphite-Mornings': { category: 'activities', subcategory: 'journaling' },
  'Graphite-in-the-Quiet': { category: 'activities', subcategory: 'study' },
  'Hammock-In-The-Shade': { category: 'seasonal-weather', subcategory: 'summer' },
  'Harbor-Before-Words': { category: 'jazzhop', subcategory: 'harbor' },
  'High-Rise-Haze': { category: 'late-night', subcategory: 'high-rise' },
  'Hour-Between-Clicks': { category: 'activities', subcategory: 'coding' },
  'Lanterns-In-Slow-Motion': { category: 'asian-lofi', subcategory: 'lantern' },
  'Last-Call-at-Table-Nine': { category: 'late-night', subcategory: 'last-call' },
  'Last-Call-in-C-Minor': { category: 'jazzhop', subcategory: 'club' },
  'Last-Train-Home': { category: 'late-night', subcategory: 'last-train' },
  'Lazy-Love-Letter-Afternoon': { category: 'soul-rnb', subcategory: 'romance' },
  'Midnight-Notes-on-the-Floor': { category: 'soul-rnb', subcategory: 'after-hours' },
  'Midnight-On-My-Mind': { category: 'late-night', subcategory: 'midnight' },
  'Midnight-Steam-And-Mango-Skin': { category: 'hybrid', subcategory: 'tropical' },
  'Midnight-Table-Talk': { category: 'soul-rnb', subcategory: 'home' },
  'Midnight-Window-Glow': { category: 'late-night', subcategory: 'window' },
  'Mist-Over-Green-Fields': { category: 'seasonal-weather', subcategory: 'nature' },
  'Misty-Mountain-Sunrise': { category: 'ambient-lofi', subcategory: 'nature' },
  'Misty-Steam-Quiet-Dreams': { category: 'asian-lofi', subcategory: 'tea-house' },
  'Moon-Through-Bamboo': { category: 'asian-lofi', subcategory: 'bamboo' },
  'Moonlit-Moss': { category: 'ambient-lofi', subcategory: 'forest' },
  'Morning-Pages': { category: 'activities', subcategory: 'journaling' },
  'Morning-in-the-Hiss': { category: 'activities', subcategory: 'morning' },
  'Old-Photos-New-Heart': { category: 'soul-rnb', subcategory: 'nostalgia' },
  'Pancakes-In-The-Sun': { category: 'activities', subcategory: 'cooking' },
  'Petals-After-Rain': { category: 'seasonal-weather', subcategory: 'spring' },
  'Picnic-Polaroids': { category: 'seasonal-weather', subcategory: 'sunny' },
  'Pixel-Quest-Save-Point': { category: 'activities', subcategory: 'gaming' },
  'Quiet-Credits': { category: 'hybrid', subcategory: 'cinematic' },
  'Quiet-Lungs-Quiet-Light': { category: 'activities', subcategory: 'meditation' },
  'Rain-Off-The-Neon-Signs': { category: 'late-night', subcategory: 'neon' },
  'Rain-On-The-Boulevard': { category: 'jazzhop', subcategory: 'rainy-city' },
  'Rain-on-Your-Hoodie': { category: 'soul-rnb', subcategory: 'rain' },
  'Roller-Rink-Reverie': { category: 'funk-soul', subcategory: 'roller-rink' },
  'Rooftop-Slow-Jam': { category: 'soul-rnb', subcategory: 'rooftop' },
  'Rooftop-Static-Dreams': { category: 'late-night', subcategory: 'rooftop' },
  'Savanna-Slow-Glow': { category: 'hybrid', subcategory: 'afrobeat' },
  'Sidewalk-Puddles': { category: 'seasonal-weather', subcategory: 'rain' },
  'Sidewalk-Slow-Jam': { category: 'chillhop', subcategory: 'city' },
  'Slow-Dance-in-the-Living-Room': { category: 'soul-rnb', subcategory: 'romance' },
  'Smoke-in-the-Orange-Sky': { category: 'funk-soul', subcategory: 'sunset' },
  'Snow-On-The-Needle': { category: 'seasonal-weather', subcategory: 'winter' },
  'Soft-Gold-Sky': { category: 'chillhop', subcategory: 'sunset' },
  'Soft-Weightless-Hours': { category: 'ambient-lofi', subcategory: 'quiet' },
  'Spring-Garden-Loops': { category: 'seasonal-weather', subcategory: 'spring' },
  'Stacks-of-Quiet-Books': { category: 'jazzhop', subcategory: 'bookstore' },
  'Stacks-of-Quiet-Hours': { category: 'activities', subcategory: 'study' },
  'Starlight-in-the-Sand': { category: 'seasonal-weather', subcategory: 'desert' },
  'Sunrise-Stretch-Flow': { category: 'activities', subcategory: 'yoga' },
  'Sunset-Offbeat': { category: 'chillhop', subcategory: 'sunset' },
  'Temple-At-Dawn': { category: 'asian-lofi', subcategory: 'temple' },
  'Thunder-in-the-Dust': { category: 'seasonal-weather', subcategory: 'storm' },
  'Tide-Pools-at-Twilight': { category: 'ambient-lofi', subcategory: 'ocean' },
  'Tide-Stained-Polaroids': { category: 'seasonal-weather', subcategory: 'ocean' },
  'Underwater-Dreamscape': { category: 'ambient-lofi', subcategory: 'underwater' },
  'VHS-Heartbeat': { category: 'hybrid', subcategory: 'synthwave' },
  'Warm-Constellations': { category: 'ambient-lofi', subcategory: 'cosmic' },
  'Warm-Mile-Markers': { category: 'late-night', subcategory: 'night-drive' },
  'Watercolors-by-the-Window': { category: 'activities', subcategory: 'painting' },
};

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

assertUniqueAlternateTitles();

const BASE_TRACK_CLASSIFICATION = Object.fromEntries(
  Object.entries(RAW_TRACK_CLASSIFICATION).map(([concept, metadata]) => [slugify(concept), metadata]),
);

const TRACK_CLASSIFICATION = {
  ...BASE_TRACK_CLASSIFICATION,
  ...Object.fromEntries(
    Object.entries(ALTERNATE_TRACK_TITLES).map(([originalSlug, alternateSlug]) => {
      const metadata = BASE_TRACK_CLASSIFICATION[originalSlug];
      if (!metadata) {
        throw new Error(`Missing base classification for alternate title: ${originalSlug} -> ${alternateSlug}`);
      }
      return [alternateSlug, metadata];
    }),
  ),
};

function formatTitleFromSlug(slug) {
  const lowerWords = new Set(['and', 'of', 'the', 'in', 'on', 'at']);
  const tokens = slug.split('-');
  const words = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (/^\d+$/.test(token) && tokens[i + 1] === 'am') {
      words.push(`${token} AM`);
      i += 1;
      continue;
    }

    const compactAm = token.match(/^(\d+)am$/);
    if (compactAm) {
      words.push(`${compactAm[1]}AM`);
      continue;
    }

    if (token === 'vhs') {
      words.push('VHS');
      continue;
    }

    if (token === 'bpm') {
      words.push('BPM');
      continue;
    }

    const normalized = token.toLowerCase();
    if (i > 0 && lowerWords.has(normalized)) {
      words.push(normalized);
      continue;
    }

    words.push(normalized.charAt(0).toUpperCase() + normalized.slice(1));
  }

  return words.join(' ');
}

function toPosixPath(value) {
  return value.split(sep).join('/');
}

function sha256File(path) {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
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

    if (!entry.isFile() || !entry.name.endsWith('.mp3')) continue;

    const relativePath = relativeDir ? join(relativeDir, entry.name) : entry.name;
    files.push(toPosixPath(relativePath));
  }

  return files;
}

function organizeTrackFiles() {
  const sourceFiles = listTrackFiles();
  const sourceSlugs = sourceFiles.map((file) => slugify(basename(file, '.mp3')));
  const missingMappings = sourceSlugs.filter((slug) => !TRACK_CLASSIFICATION[slug]);

  if (missingMappings.length) {
    throw new Error(`Missing category mappings for: ${missingMappings.join(', ')}`);
  }

  const moves = [];
  const claimedTargets = new Map();

  for (const relativePath of sourceFiles) {
    const fileSlug = slugify(basename(relativePath, '.mp3'));
    const { category } = TRACK_CLASSIFICATION[fileSlug];
    const targetRelativePath = `${category}/${fileSlug}.mp3`;

    if (claimedTargets.has(targetRelativePath) && claimedTargets.get(targetRelativePath) !== relativePath) {
      throw new Error(`Multiple source files map to ${targetRelativePath}: ${claimedTargets.get(targetRelativePath)} and ${relativePath}`);
    }
    claimedTargets.set(targetRelativePath, relativePath);

    if (relativePath !== targetRelativePath) {
      moves.push({ from: relativePath, to: targetRelativePath });
    }
  }

  for (const category of Object.keys(CATEGORY_DEFS)) {
    mkdirSync(join(TRACKS_DIR, category), { recursive: true });
  }

  for (const move of moves) {
    const fromPath = join(TRACKS_DIR, move.from);
    const toPath = join(TRACKS_DIR, move.to);
    mkdirSync(dirname(toPath), { recursive: true });
    renameSync(fromPath, toPath);
  }

  rmSync(join(TRACKS_DIR, 'original'), { recursive: true, force: true });
  rmSync(join(TRACKS_DIR, 'by-category'), { recursive: true, force: true });
}

organizeTrackFiles();

const sourceFiles = Object.keys(CATEGORY_DEFS)
  .flatMap((category) => {
    const categoryDir = join(TRACKS_DIR, category);
    return readdirSync(categoryDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.mp3'))
      .map((entry) => `${category}/${entry.name}`);
  })
  .sort((a, b) => a.localeCompare(b));

const trackSlugs = sourceFiles.map((file) => slugify(basename(file, '.mp3')));
const trackSlugSet = new Set(trackSlugs);
const staleMappings = Object.keys(TRACK_CLASSIFICATION).filter((slug) => !trackSlugSet.has(slug));

if (staleMappings.length) {
  const problems = [];
  if (staleMappings.length) {
    problems.push(`Mapped titles without source files: ${staleMappings.join(', ')}`);
  }
  throw new Error(problems.join('\n'));
}

const trackEntries = sourceFiles.map((file) => {
  const slug = slugify(basename(file, '.mp3'));
  const category = dirname(file);
  const absolutePath = join(TRACKS_DIR, file);
  const stats = statSync(absolutePath);

  return {
    title: formatTitleFromSlug(slug),
    slug,
    category,
    categoryLabel: CATEGORY_DEFS[category].label,
    file: `tracks/${file}`,
    sizeBytes: stats.size,
    sha256: sha256File(absolutePath),
  };
});

const categories = Object.entries(CATEGORY_DEFS).map(([slug, meta]) => {
  const tracks = trackEntries.filter((entry) => entry.category === slug);

  return {
    slug,
    label: meta.label,
    description: meta.description,
    trackCount: tracks.length,
  };
});

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceDirectory: 'tracks',
  trackCount: trackEntries.length,
  fileCount: sourceFiles.length,
  categories,
  tracks: trackEntries,
};

writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

const summary = categories
  .map((category) => `${category.slug}: ${category.trackCount} tracks`)
  .join('\n');

console.log(`Wrote ${CATALOG_PATH}`);
console.log(`Organized tracks under ${TRACKS_DIR}`);
console.log(summary);
