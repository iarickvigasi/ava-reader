import { requireAttempt } from '../jobs/authority';
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

it('increments snapshot version when extracted details change', async () => {
  const { prisma, tx, operation } = metadataFixture();
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      { expectedVersion: 0, title: 'Source title', language: 'en' },
      'validated-package',
    ),
  ).toEqual({ applied: true, metadataEditVersion: 1 });
  expect(tx.pdfMetadataClaim.createMany.mock.calls).toMatchObject([
    [
      {
        data: [
          { field: 'title', origin: 'extraction' },
          {
            field: 'language',
            origin: 'validated-package',
            evidence: {
              source: 'validated-package-language',
              sourceSha256: operation.sourceSha256,
            },
          },
        ],
      },
    ],
  ]);
  expect(tx.book.updateMany).toHaveBeenCalledWith({
    where: { id: 'book', metadataEditVersion: 0 },
    data: {
      title: 'Source title',
      language: 'en',
      metadataEditVersion: { increment: 1 },
    },
  });
});
it('preserves explicit user empty fields and does not advance a no-op version', async () => {
  const { prisma, tx, book, operation } = metadataFixture();
  book.metadataUserFields = ['authors', 'language'];
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      { expectedVersion: 0, authors: ['Source author'], language: 'en' },
    ),
  ).toEqual({ applied: false, metadataEditVersion: 0 });
  expect(tx.book.updateMany).not.toHaveBeenCalled();
});
it('does not apply stale extraction over a concurrent metadata edit', async () => {
  const { prisma, tx, book, operation } = metadataFixture();
  book.metadataEditVersion = 2;
  tx.book.updateMany.mockResolvedValue({ count: 0 });
  expect(
    await fillPdfMetadata(
      prisma,
      authority,
      'owner',
      'operation',
      operation.sourceSha256,
      { expectedVersion: 0, title: 'Stale source' },
    ),
  ).toEqual({ applied: false, metadataEditVersion: 2 });
});
