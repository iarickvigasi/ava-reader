import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { publishedPdfAuthority } from '../../library/pdf-import/reader/published-authority';
import { updateCanonicalProgress } from './update-progress';
import { fixture } from './test-fixture';
jest.mock('../../library/pdf-import/reader/published-authority');
const authorize = jest.mocked(publishedPdfAuthority);
function setup() {
  const value = fixture();
  const saved = {
    chapterLabel: 'Harbour',
    completionPercent: 5,
    currentLocator: null,
    lastReadAt: new Date('2026-09-29T12:00:00Z'),
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    readingProgress: {
      findUnique: jest.fn().mockResolvedValue(saved),
      upsert: jest
        .fn()
        .mockImplementation((args: { update: typeof saved }) =>
          Promise.resolve(args.update),
        ),
    },
    libraryItem: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService;
  authorize.mockResolvedValue({
    publication: { id: 'publication' },
    op: { finalContentId: 'final', libraryItemId: 'library' },
  } as Awaited<ReturnType<typeof publishedPdfAuthority>>);
  const run = (at: string) =>
    updateCanonicalProgress(
      prisma,
      value.item,
      value.accepted,
      { schema: 'ava-reader-3', build: 'b'.repeat(64) },
      { chapterId: 'chapter-one', blockId: 'body-one', textOffset: 3 },
      at,
    );
  return { tx, run };
}
beforeEach(() => authorize.mockReset());
it('persists exact source UTF16 position only after a fresh locked authority check', async () => {
  const { tx, run } = setup();
  await expect(run('2026-09-29T12:01:00Z')).resolves.toMatchObject({
    locator: { blockId: 'body-one', textOffset: 3 },
  });
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  expect(authorize).toHaveBeenCalledTimes(2);
  expect(
    (tx.readingProgress.upsert.mock.calls as unknown[][])[0][0],
  ).toMatchObject({
    create: { userId: 'owner', libraryItemId: 'library' },
  });
});
it('keeps a later position when older offline progress arrives', async () => {
  const { tx, run } = setup();
  await run('2026-09-29T11:00:00Z');
  expect(tx.readingProgress.upsert).not.toHaveBeenCalled();
});
it('does not write after deletion or revoked reader authority', async () => {
  const { tx, run } = setup();
  authorize.mockRejectedValue(new NotFoundException());
  await expect(run('2026-09-29T12:01:00Z')).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(tx.readingProgress.upsert).not.toHaveBeenCalled();
});
it('rejects a substituted accepted content identity before any progress write', async () => {
  const { tx, run } = setup();
  authorize.mockResolvedValue({
    publication: { id: 'other' },
    op: { finalContentId: 'final', libraryItemId: 'library' },
  } as Awaited<ReturnType<typeof publishedPdfAuthority>>);
  await expect(run('2026-09-29T12:01:00Z')).rejects.toThrow('changed');
  expect(tx.readingProgress.upsert).not.toHaveBeenCalled();
});

it('rejects the transaction if qualification disappears after the write', async () => {
  const { tx, run } = setup();
  tx.libraryItem.update.mockImplementation(() => {
    authorize.mockRejectedValue(new NotFoundException());
    return Promise.resolve({});
  });
  await expect(run('2026-09-29T12:01:00Z')).rejects.toBeInstanceOf(
    NotFoundException,
  );
  expect(tx.readingProgress.upsert).toHaveBeenCalledTimes(1);
});
