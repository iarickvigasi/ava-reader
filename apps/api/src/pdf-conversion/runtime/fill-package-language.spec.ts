import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import { fillPdfMetadata } from '../../library/pdf-import/metadata/fill-metadata';
import { fillReconstructedMetadata } from './fill-reconstructed-metadata';
jest.mock('../../library/pdf-import/metadata/fill-metadata');
const prisma = {} as PrismaService;
const claim = {
  authority: { attemptId: 'attempt' },
  job: {
    owner_id: 'owner',
    operation_id: 'operation',
    source: { sha256: 'a'.repeat(64) },
  },
} as ClaimedPdfJob;
beforeEach(() => jest.mocked(fillPdfMetadata).mockClear());
it('fills package English with separate provenance when no source language exists', async () => {
  const book = { profile_id: 'ava-pdf-prose-en-v2' as const, metadata: [] };
  await fillReconstructedMetadata(prisma, claim, 7, book);
  expect(fillPdfMetadata).toHaveBeenCalledWith(
    prisma,
    claim.authority,
    'owner',
    'operation',
    'a'.repeat(64),
    { expectedVersion: 7, language: 'en' },
    'validated-package',
  );
  expect(book.metadata).toEqual([]);
});
it('refuses incompatible accepted package language before any metadata write', async () => {
  await expect(
    fillReconstructedMetadata(prisma, claim, 7, {
      profile_id: 'ava-pdf-prose-en-v2',
      metadata: [
        {
          id: 'fr',
          field: 'language',
          value: 'fr',
          status: 'accepted',
          origin: 'source',
          scope: 'work',
        },
      ],
    }),
  ).rejects.toThrow('EPUB_PACKAGE_LANGUAGE_INVALID');
  expect(fillPdfMetadata).not.toHaveBeenCalled();
});
