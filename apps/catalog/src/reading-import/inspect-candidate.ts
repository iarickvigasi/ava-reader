import { inspectDigital } from './providers/inspect-digital';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchArchive } from './fetch-archive';
import { selectEpub } from './select-epub';
import { inspectionCache } from './inspection-cache';
import { MAX_EPUB_BYTES, type Candidate } from './types';

export async function inspectCandidate(
  candidate: Candidate,
  directory: string,
): Promise<Candidate> {
  if (candidate.provider && candidate.provider !== 'internet-archive')
    return inspectDigital(candidate, directory);
  const metadata = JSON.parse(
    (
      await fetchArchive(
        `https://archive.org/metadata/${candidate.iaIdentifier}`,
        4 * 1024 * 1024,
      )
    ).toString('utf8'),
  ) as Record<string, unknown>;
  const file = selectEpub(metadata, candidate.filename);
  if (Number(file.size) > MAX_EPUB_BYTES)
    throw new Error('EPUB exceeds 50 MiB');
  const filename = String(file.name);
  const bytes =
    (await inspectionCache(candidate, file)) ??
    (await fetchArchive(
      `https://archive.org/download/${candidate.iaIdentifier}/${filename.split('/').map(encodeURIComponent).join('/')}`,
      MAX_EPUB_BYTES,
    ));
  if (
    bytes.length !== Number(file.size) ||
    createHash('md5').update(bytes).digest('hex') !==
      String(file.md5).toLowerCase()
  )
    throw new Error('Archive file digest or length mismatch');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  await mkdir(directory, { recursive: true });
  const localFile = resolve(directory, `${checksum}.epub`);
  await writeFile(localFile, bytes);
  return {
    ...candidate,
    filename,
    checksum,
    localFile,
    metadata,
    fileMetadata: file,
    inspectedAt: new Date().toISOString(),
    review: null,
  };
}
