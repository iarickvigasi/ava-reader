import { providerReference } from './providers/provider-reference';
import { candidateSource } from './candidate-source';
import { readFile, stat } from 'node:fs/promises';
import { MAX_CANDIDATES, MAX_MANIFEST_BYTES, type Manifest } from './types';

export async function readManifest(path: string): Promise<Manifest> {
  if ((await stat(path)).size > MAX_MANIFEST_BYTES)
    throw new Error('Manifest too large');
  const value = JSON.parse(await readFile(path, 'utf8')) as Manifest;
  if (
    value.version !== 1 ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > MAX_CANDIDATES
  )
    throw new Error('Invalid manifest');
  const seen = new Set<string>();
  for (const entry of value.candidates) {
    if (
      !entry ||
      !/^[\da-f-]{36}$/i.test(entry.editionId) ||
      !/^[\da-f-]{36}$/i.test(entry.workId) ||
      !/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(entry.language) ||
      typeof entry.title !== 'string' ||
      !entry.title.trim() ||
      !Array.isArray(entry.authors) ||
      !entry.authors.length ||
      entry.authors.some(
        (author) => typeof author !== 'string' || !author.trim(),
      ) ||
      !/^\d+$/.test(entry.sourceRevision) ||
      !/^[\da-f]{64}$/.test(entry.sourcePayloadHash)
    )
      throw new Error('Invalid candidate identity or metadata');
    candidateSource(entry);
    providerReference(entry);
    const key = `${entry.editionId}:${entry.iaIdentifier}:${entry.filename ?? ''}`;
    if (seen.has(key)) throw new Error('Duplicate manifest candidate');
    seen.add(key);
  }
  return value;
}
