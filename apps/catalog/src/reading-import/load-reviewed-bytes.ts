import { loadDigitalBytes } from './providers/load-digital-bytes';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fetchArchive } from './fetch-archive';
import { selectEpub } from './select-epub';
import { MAX_EPUB_BYTES, type Candidate } from './types';

export async function loadReviewedBytes(candidate: Candidate) {
  if (candidate.provider && candidate.provider !== 'internet-archive')
    return loadDigitalBytes(candidate);
  if (
    !candidate.localFile ||
    !candidate.filename ||
    !/^[a-f\d]{64}$/.test(candidate.checksum ?? '')
  )
    throw new Error('Inspect this candidate before uploading a draft');
  const item = JSON.parse(
    (
      await fetchArchive(
        `https://archive.org/metadata/${candidate.iaIdentifier}`,
        4 * 1024 * 1024,
      )
    ).toString('utf8'),
  ) as Record<string, unknown>;
  const file = selectEpub(item, candidate.filename);
  if ((await stat(candidate.localFile)).size > MAX_EPUB_BYTES)
    throw new Error('EPUB exceeds 50 MiB');
  const bytes = await readFile(candidate.localFile);
  if (
    createHash('sha256').update(bytes).digest('hex') !== candidate.checksum ||
    createHash('md5').update(bytes).digest('hex') !==
      String(file.md5).toLowerCase() ||
    bytes.length !== Number(file.size)
  )
    throw new Error('Reviewed file no longer matches source');
  return bytes;
}
