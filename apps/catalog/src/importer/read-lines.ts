import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { MAX_LINE_BYTES } from './types';

// Bound memory even for a corrupt line without a newline. null marks an oversized line.
export async function* readLines(
  filename: string,
): AsyncGenerator<string | null> {
  const file = createReadStream(filename);
  const input = filename.endsWith('.gz')
    ? file.compose<Readable>(createGunzip())
    : file;
  let parts: Buffer[] = [];
  let size = 0;
  let oversized = false;
  try {
    for await (const raw of input) {
      const chunk = raw as Buffer;
      let start = 0;
      for (let i = 0; i <= chunk.length; i++) {
        if (i < chunk.length && chunk[i] !== 10) continue;
        const part = chunk.subarray(start, i);
        size += part.length;
        if (size > MAX_LINE_BYTES) {
          oversized = true;
          parts = [];
        } else if (!oversized && part.length) parts.push(part);
        if (i < chunk.length) {
          yield oversized
            ? null
            : Buffer.concat(parts).toString('utf8').replace(/\r$/, '');
          parts = [];
          size = 0;
          oversized = false;
        }
        start = i + 1;
      }
    }
    if (size || oversized)
      yield oversized ? null : Buffer.concat(parts).toString('utf8');
  } finally {
    input.destroy();
    file.destroy();
  }
}
