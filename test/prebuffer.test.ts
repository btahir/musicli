import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { createPlaybackPrebuffer } from '../src/audio/prebuffer.js';

async function collectDataEvents(stream: Readable): Promise<Buffer[]> {
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  await once(stream, 'end');
  return chunks;
}

test('createPlaybackPrebuffer batches startup audio until the threshold is met', async () => {
  const source = Readable.from([Buffer.from('ab'), Buffer.from('cd'), Buffer.from('ef')]);
  const buffered = source.pipe(createPlaybackPrebuffer(4));
  const chunks = await collectDataEvents(buffered);

  assert.deepEqual(chunks.map((chunk) => chunk.toString('utf8')), ['abcd', 'ef']);
});

test('createPlaybackPrebuffer flushes remaining audio when the source ends early', async () => {
  const source = Readable.from([Buffer.from('ab'), Buffer.from('cd')]);
  const buffered = source.pipe(createPlaybackPrebuffer(10));
  const chunks = await collectDataEvents(buffered);

  assert.deepEqual(chunks.map((chunk) => chunk.toString('utf8')), ['abcd']);
});
