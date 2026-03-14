import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES_DIR } from '../runtime/paths.js';
import type { CellBuffer } from '../renderer/buffer.js';
import type { Region } from '../renderer/layout.js';
import { ChafaImageScene, resolveChafaCommand } from './chafa.js';
import { DitheredImageScene } from './image.js';
import type { Scene } from './types.js';

export interface SceneCatalog {
  sceneNames: string[];
  scenes: Map<string, Scene>;
}

export type SceneRendererMode = 'auto' | 'builtin' | 'chafa';

class FallbackScene implements Scene {
  private readonly primary: Scene;
  private readonly fallback: Scene;
  private active: Scene;
  private failed = false;

  constructor(primary: Scene, fallback: Scene) {
    this.primary = primary;
    this.fallback = fallback;
    this.active = primary;
  }

  init(width: number, height: number): void {
    if (this.failed) {
      this.fallback.init(width, height);
      return;
    }

    try {
      this.primary.init(width, height);
    } catch {
      this.failed = true;
      this.active = this.fallback;
      this.fallback.init(width, height);
    }
  }

  render(buffer: CellBuffer, region: Region): void {
    if (this.failed) {
      this.fallback.render(buffer, region);
      return;
    }

    try {
      this.primary.render(buffer, region);
    } catch {
      this.failed = true;
      this.active = this.fallback;
      this.fallback.init(region.width, region.height);
      this.fallback.render(buffer, region);
    }
  }
}

function createScene(filePath: string, mode: SceneRendererMode): Scene {
  const builtin = new DitheredImageScene(filePath);

  if (mode === 'builtin') {
    return builtin;
  }

  const chafaCommand = resolveChafaCommand();
  if (!chafaCommand) {
    if (mode === 'chafa') {
      throw new Error('Chafa renderer requested, but the `chafa` binary was not found. Install it with `brew install chafa` or `sudo apt install chafa`.');
    }
    return builtin;
  }

  const chafa = new ChafaImageScene(filePath, chafaCommand);
  if (mode === 'chafa') {
    return chafa;
  }

  return new FallbackScene(chafa, builtin);
}

export function listSceneNames(): string[] {
  if (!existsSync(SCENES_DIR)) {
    return [];
  }

  return readdirSync(SCENES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name.replace(/\.png$/i, ''))
    .sort((a, b) => a.localeCompare(b));
}

export function loadScenes(mode: SceneRendererMode = 'auto'): SceneCatalog {
  const scenes = new Map<string, Scene>();
  const sceneNames = listSceneNames();

  for (const name of sceneNames) {
    scenes.set(name, createScene(join(SCENES_DIR, `${name}.png`), mode));
  }

  return { sceneNames, scenes };
}
