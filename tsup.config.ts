import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  external: ['speaker'],
  banner: {
    js: '#!/usr/bin/env node',
  },
  clean: true,
  sourcemap: true,
});
