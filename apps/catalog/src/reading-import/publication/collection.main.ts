import 'dotenv/config';
import { parseArgs } from 'node:util';
import { readManifest } from '../read-manifest';
import { mainApi } from '../main-api';
import { researchedWork } from '../evidence/researched-work';
import { publishCollectionCopy } from './publish-collection-copy';
async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', multiple: true },
      apply: { type: 'boolean' },
    },
  });
  if (!values.file?.length)
    throw new Error(
      'Use --file inspected.json [--file another.json] [--apply]',
    );
  const manifests = await Promise.all(values.file.map(readManifest));
  const candidates = manifests.flatMap((manifest) => manifest.candidates);
  const eligible = candidates.filter(
    (candidate) =>
      researchedWork(candidate)?.publicationPolicy ===
      'PUBLISH_WITH_REVIEW_DEFERRED',
  );
  if (!values.apply) {
    console.log(
      JSON.stringify({
        mode: 'dry-run',
        eligible: eligible.length,
        skipped: candidates.length - eligible.length,
      }),
    );
    return;
  }
  let failures = 0;
  for (const candidate of eligible) {
    try {
      const status = await publishCollectionCopy(
        candidate,
        await mainApi(candidate),
      );
      console.log(
        JSON.stringify({
          title: candidate.title,
          editionId: candidate.editionId,
          status: status.status,
        }),
      );
    } catch (error) {
      failures++;
      console.error(
        JSON.stringify({
          title: candidate.title,
          error: error instanceof Error ? error.message : 'Publication failed',
        }),
      );
    }
  }
  if (failures) process.exitCode = 2;
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Invalid plan');
  process.exitCode = 1;
});
