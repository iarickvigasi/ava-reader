import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function identifyFile(filename: string) {
  const before = await stat(filename);
  if (!before.isFile()) throw new Error('Input must be a regular file');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename))
    hash.update(chunk as Buffer);
  const after = await stat(filename);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error('Input changed while hashing');
  }
  return {
    checksum: hash.digest('hex'),
    size: after.size,
    mtime: after.mtimeMs,
  };
}
