import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Candidate } from '../types';
import { digitalSource } from './digital-source';
export async function inspectDigital(
  candidate: Candidate,
  directory: string,
): Promise<Candidate> {
  const { bytes, metadata, sourceUrl, downloadUrl, filename } =
    await digitalSource(candidate);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  await mkdir(directory, { recursive: true });
  const localFile = resolve(directory, `${checksum}.epub`);
  await writeFile(localFile, bytes);
  return {
    ...candidate,
    filename,
    checksum,
    localFile,
    sourceUrl,
    downloadUrl,
    metadata,
    fileMetadata: {
      name: filename,
      size: bytes.length,
      sha256: checksum,
      downloadUrl,
    },
    inspectedAt: new Date().toISOString(),
    review: null,
  };
}
