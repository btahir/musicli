export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  scene: Region;
  separator1: number;
  nowPlaying: Region;
  separator2: number;
  volumeBars: Region;
  separator3: number;
  hints: Region;
}

const MIN_SCENE_H = 4;
const NOW_PLAYING_H = 1;
const HINTS_H = 1;
const SEPARATORS = 3;
const MAX_VOLUME_ROWS = 13;
const COMPACT_LAYOUT_MIN_ROWS = 9;

export function computeLayout(cols: number, rows: number): Layout {
  if (rows < COMPACT_LAYOUT_MIN_ROWS) {
    const sceneH = Math.max(1, rows - 3);
    const separator1 = sceneH;
    const nowPlayingY = Math.max(0, Math.min(rows - 2, separator1 + 1));
    const hintsY = Math.max(nowPlayingY + 1, rows - 1);

    return {
      scene: { x: 0, y: 0, width: cols, height: sceneH },
      separator1,
      nowPlaying: { x: 0, y: nowPlayingY, width: cols, height: NOW_PLAYING_H },
      separator2: rows,
      volumeBars: { x: 0, y: rows, width: cols, height: 0 },
      separator3: rows,
      hints: { x: 0, y: Math.min(hintsY, rows - 1), width: cols, height: HINTS_H },
    };
  }

  // Figure out how many volume rows we can afford
  const fixedChrome = NOW_PLAYING_H + HINTS_H + SEPARATORS;
  const availableForScene = rows - fixedChrome;

  // Give scene at least MIN_SCENE_H, then fill volume rows with the rest
  let volumeH: number;
  if (availableForScene >= MIN_SCENE_H + MAX_VOLUME_ROWS) {
    volumeH = MAX_VOLUME_ROWS;
  } else {
    // Squeeze: give scene its minimum, volume gets whatever is left
    volumeH = Math.max(1, availableForScene - MIN_SCENE_H);
  }
  volumeH = Math.min(volumeH, MAX_VOLUME_ROWS);

  const sceneH = Math.max(MIN_SCENE_H, rows - fixedChrome - volumeH);
  let y = 0;
  const scene: Region = { x: 0, y, width: cols, height: sceneH };
  y += sceneH;

  const separator1 = y++;

  const nowPlaying: Region = { x: 0, y, width: cols, height: NOW_PLAYING_H };
  y += NOW_PLAYING_H;

  const separator2 = y++;

  const volumeBars: Region = { x: 0, y, width: cols, height: volumeH };
  y += volumeH;

  const separator3 = y++;

  const hints: Region = { x: 0, y, width: cols, height: HINTS_H };

  return { scene, separator1, nowPlaying, separator2, volumeBars, separator3, hints };
}
