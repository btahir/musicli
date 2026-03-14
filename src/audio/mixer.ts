export interface MixerState {
  music: number;
  rain: number;
  cafe: number;
  fire: number;
  thunder: number;
  forest: number;
  city: number;
}

export type MixerChannelKey = keyof MixerState;
export type AmbientKey = Exclude<MixerChannelKey, 'music'>;
export const DEFAULT_TRACK_VOLUME = 0.25;

export const AMBIENT_KEYS: AmbientKey[] = ['rain', 'cafe', 'fire', 'thunder', 'forest', 'city'];

export const MIXER_CHANNELS: ReadonlyArray<{ key: MixerChannelKey; label: string }> = [
  { key: 'music', label: 'track' },
  { key: 'rain', label: 'rain' },
  { key: 'cafe', label: 'cafe' },
  { key: 'fire', label: 'fire' },
  { key: 'thunder', label: 'thunder' },
  { key: 'forest', label: 'forest' },
  { key: 'city', label: 'city' },
];

export function defaultMixerState(): MixerState {
  return { music: DEFAULT_TRACK_VOLUME, rain: 0, cafe: 0, fire: 0, thunder: 0, forest: 0, city: 0 };
}

export function activeAmbientKeys(state: MixerState): AmbientKey[] {
  return AMBIENT_KEYS.filter(k => state[k] > 0);
}

export function buildWeights(state: MixerState, activeKeys: AmbientKey[]): string {
  return [state.music, ...activeKeys.map(k => state[k])].join(' ');
}

export function adjustVolume(state: MixerState, key: keyof MixerState, delta: number): MixerState {
  const newVal = Math.max(0, Math.min(1, state[key] + delta));
  return { ...state, [key]: Math.round(newVal * 100) / 100 };
}

export function muteMixerState(state: MixerState): MixerState {
  return {
    ...state,
    music: 0,
    rain: 0,
    cafe: 0,
    fire: 0,
    thunder: 0,
    forest: 0,
    city: 0,
  };
}
