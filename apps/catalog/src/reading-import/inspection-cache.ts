import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MAX_EPUB_BYTES, type Candidate } from './types';

export async function inspectionCache(
  candidate: Candidate,
  file: Record<string, unknown>,
) {
  if (!candidate.localFile || !candidate.checksum) return undefined;
  try {
    if ((await stat(candidate.localFile)).size > MAX_EPUB_BYTES)
      return undefined;
    const bytes = await readFile(candidate.localFile);
    if (
      bytes.length === Number(file.size) &&
      createHash('sha256').update(bytes).digest('hex') === candidate.checksum &&
      createHash('md5').update(bytes).digest('hex') ===
        String(file.md5).toLowerCase()
    )
      return bytes;
  } catch {
    /* Missing or unreadable inspection cache is downloaded again. */
  }
  return undefined;
}
