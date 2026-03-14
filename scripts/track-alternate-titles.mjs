export const ALTERNATE_TRACK_TITLES = {
  '2-am-debug-loop': 'terminal-rain',
  '3-am-echoes': 'empty-street-static',
  '3am-sink-light': 'porcelain-heartbeat',
  'a-taste-of-spring': 'bloom-between-showers',
  'ashes-in-the-coffee-cup': 'velvet-cigarette-haze',
  'aurora-on-mute': 'polar-afterglow',
  'autumn-on-the-window-glass': 'amber-windowpane',
  'barefoot-in-the-kitchen': 'slow-dancing-by-the-stove',
  'basement-groove-86': 'cassette-basement-bounce',
  'block-party-slow-jam': 'summer-curbside-glow',
  'breezy-afternoon-terrace': 'linen-and-limoncello',
  'candle-wax-heart': 'velvet-candle-smoke',
  'candlelit-at-70-bpm': 'midnight-amber-room',
  'cathedral-hiss': 'stained-glass-static',
  'deep-space-loop': 'orbiting-in-silence',
  'dog-eared-pages': 'chapter-by-lamplight',
  'drifting-through-fog': 'ghosts-on-the-hillside',
  'dust-in-the-curtains': 'sunday-light-through-lace',
  'dust-on-the-morning-keys': 'window-seat-daydream',
  'dust-on-the-needle': 'motel-soul-radio',
  'dusty-jukebox-heart': 'neon-on-the-diner-floor',
  'faded-corners-of-the-page': 'margin-notes-at-dusk',
  'fallen-leaves-loop': 'amber-sidewalks',
  'fireplace-loop': 'embers-after-midnight',
  'golden-afternoon-groove': 'honey-on-the-speakers',
  'grandmas-kitchen-on-sunday': 'peach-cobbler-static',
  'graphite-in-the-quiet': 'penciled-sunbeams',
  'graphite-mornings': 'coffee-ring-notebook',
  'hammock-in-the-shade': 'palm-breeze-nap',
  'high-rise-haze': 'elevator-to-the-moon',
  'hour-between-clicks': 'cursor-after-midnight',
  'lanterns-in-slow-motion': 'paper-lantern-rain',
  'last-call-at-table-nine': 'half-empty-coupe',
  'last-train-home': 'platform-after-rain',
  'lazy-love-letter-afternoon': 'envelope-on-the-bed',
  'midnight-notes-on-the-floor': 'scattered-sheet-music',
  'midnight-on-my-mind': 'streetlights-in-the-rearview',
  'midnight-table-talk': 'kitchen-after-the-party',
  'midnight-window-glow': 'blinds-and-headlights',
  'mist-over-green-fields': 'fieldnotes-at-dawn',
  'misty-mountain-sunrise': 'first-light-on-the-ridge',
  'misty-steam-quiet-dreams': 'teacup-morning-fog',
  'moon-through-bamboo': 'bamboo-shadow-waltz',
  'moonlit-moss': 'green-after-midnight',
  'morning-in-the-hiss': 'kettle-before-work',
  'morning-pages': 'first-coffee-thoughts',
  'old-photos-new-heart': 'polaroids-in-a-shoebox',
  'pancakes-in-the-sun': 'butter-and-windowlight',
  'petals-after-rain': 'blossoms-on-the-pavement',
  'picnic-polaroids': 'lemonade-film-grain',
  'pixel-quest-save-point': 'continue-screen-dreams',
  'quiet-credits': 'end-scene-glow',
  'quiet-lungs-quiet-light': 'exhale-the-morning',
  'rain-off-the-neon-signs': 'electric-puddles',
  'rain-on-the-boulevard': 'saxophone-in-the-rain',
  'roller-rink-reverie': 'mirrorball-slow-roll',
  'rooftop-slow-jam': 'skyline-and-satin',
  'rooftop-static-dreams': 'antenna-after-midnight',
  'savanna-slow-glow': 'dusk-on-red-earth',
  'sidewalk-puddles': 'after-school-rain',
  'sidewalk-slow-jam': 'dusk-between-stoops',
  'slow-dance-in-the-living-room': 'record-player-embrace',
  'smoke-in-the-orange-sky': 'burnt-sunset-groove',
  'snow-on-the-needle': 'winter-turntable',
  'soft-gold-sky': 'porchlight-golden-hour',
  'soft-weightless-hours': 'almost-floating',
  'spring-garden-loops': 'petals-in-the-breeze',
  'stacks-of-quiet-books': 'dust-and-hardcovers',
  'starlight-in-the-sand': 'moon-over-red-dunes',
  'sunrise-stretch-flow': 'mat-and-morning-light',
  'sunset-offbeat': 'glow-on-the-overpass',
  'temple-at-dawn': 'bells-before-sunrise',
  'thunder-in-the-dust': 'storm-over-side-streets',
  'tide-pools-at-twilight': 'sea-glass-evening',
  'underwater-dreamscape': 'blue-below-the-surface',
  'vhs-heartbeat': 'cassette-pastel-nights',
  'warm-constellations': 'satellite-lullaby',
  'warm-mile-markers': 'headlights-on-the-divider',
  'watercolors-by-the-window': 'brushstrokes-and-rain',
};

export function assertUniqueAlternateTitles() {
  const originals = new Set(Object.keys(ALTERNATE_TRACK_TITLES));
  const alternates = Object.values(ALTERNATE_TRACK_TITLES);
  const collisions = alternates.filter((slug) => originals.has(slug));
  const duplicates = alternates.filter((slug, index) => alternates.indexOf(slug) !== index);

  if (collisions.length || duplicates.length) {
    const problems = [];
    if (collisions.length) {
      problems.push(`Alternate titles collide with original titles: ${collisions.join(', ')}`);
    }
    if (duplicates.length) {
      problems.push(`Duplicate alternate titles: ${[...new Set(duplicates)].join(', ')}`);
    }
    throw new Error(problems.join('\n'));
  }
}
