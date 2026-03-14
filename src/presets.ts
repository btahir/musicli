import type { AmbientKey } from './audio/mixer.js';

export interface Preset {
  ambience: Partial<Record<AmbientKey, number>>;
  scene: string;
  label: string;
}

export const PRESETS: Record<string, Preset> = {
  study: {
    ambience: {},
    scene: 'city',
    label: 'deep focus — beats to study to',
  },
  chill: {
    ambience: { cafe: 0.3 },
    scene: 'balcony',
    label: 'coffee shop — chill vibes',
  },
  jazz: {
    ambience: { cafe: 0.2 },
    scene: 'rooftop',
    label: 'jazz club — smoky evening',
  },
  sleep: {
    ambience: { rain: 0.2, forest: 0.15 },
    scene: 'treehouse',
    label: 'floating — ambient drift',
  },
  night: {
    ambience: { city: 0.3, rain: 0.2 },
    scene: 'alley',
    label: 'neon reflections — nocturnal',
  },
  nature: {
    ambience: { forest: 0.4, rain: 0.1 },
    scene: 'park',
    label: 'bamboo forest — nature',
  },
  soul: {
    ambience: { fire: 0.3 },
    scene: 'bookshop',
    label: 'slow dance — warm soul',
  },
  snow: {
    ambience: { fire: 0.2 },
    scene: 'porch',
    label: 'snowfall — winter quiet',
  },
};
