jest.mock('../../reader/canonical/load', () => ({
  loadCanonicalReader: jest.fn(),
}));
jest.mock('../../reader/package/load-reader-package', () => ({
  loadReaderPackage: jest.fn(),
}));
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import { loadCanonicalReader } from '../../reader/canonical/load';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { fixture } from '../../reader/canonical/test-fixture';
import { loadTranslationContext } from './load-context';
it('loads an accepted primary-EPUB publication by owned authority without a legacy reparse', async () => {
  const { item, accepted } = fixture();
  item.book.files[0].format = 'EPUB';
  const prisma = {
    libraryItem: { findFirst: jest.fn().mockResolvedValue(item) },
  } as unknown as PrismaService;
  const users = {
    getCurrentUserRecord: jest.fn().mockResolvedValue({ id: item.userId }),
  } as unknown as UsersService;
  const capability = { schema: 'ava-reader-3', build: 'b'.repeat(64) };
  jest.mocked(loadCanonicalReader).mockResolvedValue(accepted);
  const context = await loadTranslationContext({
    prisma,
    users,
    clerkUserId: 'clerk',
    libraryItemId: item.id,
    chapterId: 'chapter-one',
    targetLang: 'French',
    capability,
  });
  expect(context.contentRevision).toBe('final');
  expect(context.units.some((u) => u.blockId === 'cell-11')).toBe(true);
  expect(loadCanonicalReader).toHaveBeenCalledWith(prisma, item, capability);
  expect(loadReaderPackage).not.toHaveBeenCalled();
  jest.mocked(loadCanonicalReader).mockRejectedValue(new Error('unqualified'));
  await expect(
    loadTranslationContext({
      prisma,
      users,
      clerkUserId: 'clerk',
      libraryItemId: item.id,
      chapterId: 'chapter-one',
      targetLang: 'French',
      capability,
    }),
  ).rejects.toThrow('unqualified');
  expect(loadReaderPackage).not.toHaveBeenCalled();
});
