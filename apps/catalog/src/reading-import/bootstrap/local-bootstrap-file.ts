import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MAX_EPUB_BYTES } from '../types';
export async function localBootstrapFile(path?: string) {
  if (!path) return {};
  if ((await stat(path)).size > MAX_EPUB_BYTES)
    throw new Error('Local EPUB exceeds 50 MiB');
  const bytes = await readFile(path);
  return {
    localFile: path,
    checksum: createHash('sha256').update(bytes).digest('hex'),
  };
}
