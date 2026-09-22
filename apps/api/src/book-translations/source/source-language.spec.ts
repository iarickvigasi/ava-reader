import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import {
  getOwnedLibraryItem,
  findReadyDerivedReader,
} from '../../reader/library-item-access';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { loadTranslationContext } from './load-context';
import { buildSentenceCatalog } from './sentence-catalog';
import { chapterFixture } from '../testing/translation.fixture';

jest.mock('../../reader/library-item-access');
jest.mock('../../reader/package/load-reader-package');

it('segments the owned book with its Greek language, independently of the French target', async () => {
  const text = 'Αυτό είναι τεστ; Ναι είναι. Τέλος.';
  const chapter = {
    ...chapterFixture,
    blocks: [
      {
        id: 'p-1',
        kind: 'paragraph' as const,
        text,
        inlines: [{ kind: 'text' as const, text }],
      },
    ],
  };
  jest.mocked(getOwnedLibraryItem).mockResolvedValue({
    id: 'library-1',
    userId: 'user-1',
    book: { title: 'Book', authors: ['Writer'], language: 'el' },
  } as Awaited<ReturnType<typeof getOwnedLibraryItem>>);
  jest.mocked(findReadyDerivedReader).mockReturnValue({
    id: 'file-1',
    blobId: 'blob-1',
  } as ReturnType<typeof findReadyDerivedReader>);
  jest
    .mocked(loadReaderPackage)
    .mockResolvedValue({ chapters: [chapter] } as Awaited<
      ReturnType<typeof loadReaderPackage>
    >);

  const context = await loadTranslationContext({
    prisma: {} as PrismaService,
    users: {} as UsersService,
    clerkUserId: 'clerk-1',
    libraryItemId: 'library-1',
    chapterId: chapter.chapterId,
    targetLang: 'French',
  });
  expect(context.sourceLanguage).toBe('el');
  expect(context.units.map((unit) => unit.text)).toEqual([
    'Αυτό είναι τεστ; ',
    'Ναι είναι. ',
    'Τέλος.',
  ]);
  for (const unit of context.units) {
    expect(text.slice(unit.startOffset, unit.endOffset)).toBe(unit.text);
  }
  const previous = buildSentenceCatalog(chapter, 'file-1', 'en');
  expect(previous).toHaveLength(2);
  expect(context.units.at(-1)?.id).toBe(previous.at(-1)?.id);
});
