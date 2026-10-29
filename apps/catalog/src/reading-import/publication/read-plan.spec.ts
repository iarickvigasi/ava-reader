import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approvalFixture } from './approval-fixture';
import { readPublicationPlan } from './read-plan';
let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'publication-'));
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});
async function plan(publication: unknown) {
  const path = join(folder, 'plan.json');
  await writeFile(
    path,
    JSON.stringify({ version: 1, books: [{ id: 'book', publication }] }),
  );
  return readPublicationPlan(path);
}
it('skips research-only books without inventing approval', async () => {
  expect(await plan(null)).toEqual({ approvals: [], skipped: 1 });
});
it('accepts explicit exact-file approval', async () => {
  expect((await plan(approvalFixture)).approvals).toEqual([approvalFixture]);
});
it.each([
  { ...approvalFixture, checksum: 'b'.repeat(64) },
  {
    ...approvalFixture,
    review: { ...approvalFixture.review, qualityConfirmed: false },
  },
  {
    ...approvalFixture,
    review: { ...approvalFixture.review, rightsConfirmed: false },
  },
  {
    ...approvalFixture,
    review: { ...approvalFixture.review, rightsUrl: 'http://example.org' },
  },
])(
  'rejects changed bytes, missing confirmations, and insecure evidence',
  async (approval) => {
    await expect(plan(approval)).rejects.toThrow();
  },
);
