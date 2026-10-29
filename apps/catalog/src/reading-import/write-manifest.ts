import { writeFile, rename } from 'node:fs/promises';
import { MAX_MANIFEST_BYTES, type Manifest } from './types';

export async function writeManifest(path: string, manifest: Manifest) {
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (Buffer.byteLength(json) > MAX_MANIFEST_BYTES)
    throw new Error('Manifest exceeds 32 MiB; use a smaller batch');
  const temporary = `${path}.tmp`;
  await writeFile(temporary, json);
  await rename(temporary, path);
}
