import { dirname, resolve } from 'node:path';
import type { CatalogDatabase } from '../database/catalog-database';
import { readManifest } from './read-manifest';
import { inspectCandidate } from './inspect-candidate';
import { applyCandidate } from './apply-candidate';
import { assertCandidateMapping } from './assert-candidate-mapping';
import { writeManifest } from './write-manifest';

export async function runManifest(
  db: CatalogDatabase,
  options: {
    file: string;
    output?: string;
    mode: 'inspect' | 'apply';
  },
) {
  const manifest = await readManifest(options.file);
  let failures = 0;
  let pending = 0;
  if (options.mode === 'inspect')
    await writeManifest(resolve(options.output!), manifest);
  for (let index = 0; index < manifest.candidates.length; index++) {
    const candidate = manifest.candidates[index];
    try {
      await assertCandidateMapping(db, candidate);
      if (options.mode === 'inspect') {
        const output = resolve(options.output!);
        manifest.candidates[index] = await inspectCandidate(
          candidate,
          `${output}.files`,
        );
        // Preserve completed inspections after each item. Re-inspection always clears approval.
        await writeManifest(output, manifest);
      } else {
        if (candidate.localFile && !candidate.localFile.startsWith('/'))
          candidate.localFile = resolve(
            dirname(options.file),
            candidate.localFile,
          );
        const receipt = await applyCandidate(db, candidate);
        if (receipt.status === 'PENDING') pending++;
        console.log(JSON.stringify(receipt));
      }
    } catch (error) {
      failures++;
      console.error(
        JSON.stringify({
          editionId: candidate.editionId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return { candidates: manifest.candidates.length, failures, pending };
}
