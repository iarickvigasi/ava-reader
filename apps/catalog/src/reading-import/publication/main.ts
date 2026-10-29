import 'dotenv/config';
import { parseArgs } from 'node:util';
import { readPublicationPlan } from './read-plan';
import { publishApproval } from './publish-plan';
async function main() {
  const { values } = parseArgs({
    options: { file: { type: 'string' }, apply: { type: 'boolean' } },
  });
  if (!values.file) throw new Error('Use --file plan.json [--apply]');
  const { approvals, skipped } = await readPublicationPlan(values.file);
  if (!values.apply) {
    console.log(
      JSON.stringify({
        mode: 'dry-run',
        eligible: approvals.length,
        skipped,
        editions: approvals.map((a) => a.editionId),
      }),
    );
    return;
  }
  let failures = 0;
  for (const approval of approvals) {
    try {
      console.log(
        JSON.stringify({
          editionId: approval.editionId,
          result: await publishApproval(approval),
        }),
      );
    } catch (error) {
      failures++;
      console.error(
        JSON.stringify({
          editionId: approval.editionId,
          error: error instanceof Error ? error.message : 'Publication failed',
        }),
      );
    }
  }
  console.log(
    JSON.stringify({ attempted: approvals.length, skipped, failures }),
  );
  if (failures) process.exitCode = 2;
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Invalid publication plan',
  );
  process.exitCode = 1;
});
