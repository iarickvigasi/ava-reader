import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Candidate } from '../types';
import { MAX_EPUB_BYTES } from '../types';
import { digitalSource } from './digital-source';
export async function loadDigitalBytes(candidate: Candidate) {
  if (
    !candidate.localFile ||
    !candidate.checksum ||
    !candidate.downloadUrl ||
    !candidate.inspectedAt
  )
    throw new Error('Inspect the digital EPUB before uploading a draft');
  if ((await stat(candidate.localFile)).size > MAX_EPUB_BYTES)
    throw new Error('EPUB exceeds 50 MiB');
  const bytes = await readFile(candidate.localFile);
  const current = await digitalSource(candidate);
  if (
    createHash('sha256').update(bytes).digest('hex') !== candidate.checksum ||
    createHash('sha256').update(current.bytes).digest('hex') !==
      candidate.checksum
  )
    throw new Error('Provider EPUB changed; inspect again before importing');
  return bytes;
}
