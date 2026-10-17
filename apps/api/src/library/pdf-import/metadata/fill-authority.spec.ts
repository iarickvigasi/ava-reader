import { requireAttempt } from '../jobs/authority';
import { JobAuthorityError } from '../jobs/errors';
import { fillPdfMetadata } from './fill-metadata';
import { metadataFixture } from './test-fixture';
jest.mock('../jobs/authority');
const authority = {
  principalId: 'principal',
  token: 'token',
  attemptId: 'attempt',
  attemptToken: 'attempt-token',
};
beforeEach(() => {
  jest
    .mocked(requireAttempt)
    .mockReset()
    .mockResolvedValue({
      attempt: { job: { operation: metadataFixture().operation } },
      job: {
        owner_id: 'owner',
        operation_id: 'operation',
        source: { sha256: 'a'.repeat(64) },
      },
    } as unknown as Awaited<ReturnType<typeof requireAttempt>>);
});

it('refuses an expired or superseded attempt before claims or metadata writes', async () => {
  const { prisma, tx, operation } = metadataFixture();
  jest.mocked(requireAttempt).mockRejectedValue(new JobAuthorityError());
  await expect(
    fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      { expectedVersion: 0, title: 'Late' },
    ),
  ).rejects.toBeInstanceOf(JobAuthorityError);
  expect(tx.pdfMetadataClaim.createMany).not.toHaveBeenCalled();
  expect(tx.book.updateMany).not.toHaveBeenCalled();
});
it('refuses a source or owner substitution before claims or metadata writes', async () => {
  const { prisma, tx } = metadataFixture();
  await expect(
    fillPdfMetadata(prisma, authority, 'other', 'operation', 'b'.repeat(64), {
      expectedVersion: 0,
      title: 'Wrong',
    }),
  ).rejects.toBeInstanceOf(JobAuthorityError);
  expect(tx.pdfMetadataClaim.createMany).not.toHaveBeenCalled();
  expect(tx.book.updateMany).not.toHaveBeenCalled();
});
