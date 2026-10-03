import type { PrismaService } from '../../prisma/prisma.service';
import { assertCanonicalTranslationAuthority } from '../source/assert-canonical-authority';
import { translationContext } from '../testing/translation.fixture';
import { persistCanonicalAlignment } from './persist-canonical-alignment';
jest.mock('../source/assert-canonical-authority');
const authority = jest.mocked(assertCanonicalTranslationAuthority);
beforeEach(() => authority.mockReset());
it('checks authority before and after an item-locked canonical write', async () => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    sentenceTranslation: {},
  };
  const prisma = {
    $transaction: jest.fn((run: (tx: unknown) => unknown) => run(tx)),
  } as unknown as PrismaService;
  const context = {
    ...translationContext(),
    canonicalAuthority: {
      operationId: 'op',
      publicationId: 'pub',
      finalContentId: 'final',
      schema: 'ava-reader-3',
      build: 'b'.repeat(64),
    },
  };
  const write = jest.fn().mockResolvedValue({ count: 1 });
  await expect(
    persistCanonicalAlignment(prisma, context, write),
  ).resolves.toEqual({ count: 1 });
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  expect(authority).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledWith(tx);
  authority.mockRejectedValueOnce(new Error('revoked'));
  write.mockClear();
  await expect(
    persistCanonicalAlignment(prisma, context, write),
  ).rejects.toThrow('revoked');
  expect(write).not.toHaveBeenCalled();
  authority
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('revoked late'));
  await expect(
    persistCanonicalAlignment(prisma, context, write),
  ).rejects.toThrow('revoked late');
});
it('keeps the ordinary EPUB persistence path independent of PDF authority', async () => {
  const prisma = {} as PrismaService;
  const write = jest.fn().mockResolvedValue({ count: 0 });
  expect(
    await persistCanonicalAlignment(prisma, translationContext(), write),
  ).toEqual({ count: 0 });
  expect(authority).not.toHaveBeenCalled();
});
