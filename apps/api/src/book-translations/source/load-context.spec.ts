import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookFileKind, ProcessingStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import { loadReaderPackage } from '../../reader/package/load-reader-package';
import { loadTranslationContext } from './load-context';
import { chapterFixture } from '../testing/translation.fixture';

jest.mock('../../reader/package/load-reader-package', () => ({
  loadReaderPackage: jest.fn(),
}));

describe('owned translation source', () => {
  const findFirst = jest.fn();
  const getCurrentUserRecord = jest.fn();
  const args = {
    prisma: { libraryItem: { findFirst } } as unknown as PrismaService,
    users: { getCurrentUserRecord } as unknown as UsersService,
    clerkUserId: 'clerk-1',
    libraryItemId: 'book-slug',
    chapterId: 'chapter-1',
    targetLang: 'French',
  };
  const owned = {
    id: 'library-1',
    userId: 'user-1',
    book: {
      title: 'Book',
      authors: ['Writer'],
      language: 'en',
      files: [
        {
          id: 'file-1',
          blobId: 'blob-1',
          kind: BookFileKind.DERIVED_READER,
          processingStatus: ProcessingStatus.READY,
          isPrimary: true,
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
    findFirst.mockResolvedValue(owned);
    jest
      .mocked(loadReaderPackage)
      .mockResolvedValue({ chapters: [chapterFixture] } as Awaited<
        ReturnType<typeof loadReaderPackage>
      >);
  });

  it('enforces the authenticated owner before reading source content', async () => {
    findFirst.mockResolvedValue(null);
    await expect(loadTranslationContext(args)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          OR: [{ id: 'book-slug' }, { slug: 'book-slug' }],
        },
      }),
    );
    expect(loadReaderPackage).not.toHaveBeenCalled();
  });

  it('resolves slugs to owned library IDs and the current reader-file ID', async () => {
    const context = await loadTranslationContext(args);
    expect(context).toMatchObject({
      libraryItemId: 'library-1',
      contentRevision: 'file-1',
      translationVersion: 1,
    });
    expect(context.units).toHaveLength(2);
  });

  it('refuses unreadable books and unknown chapter IDs', async () => {
    await expect(
      loadTranslationContext({ ...args, chapterId: 'foreign-chapter' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    findFirst.mockResolvedValue({
      ...owned,
      book: { ...owned.book, files: [] },
    });
    await expect(loadTranslationContext(args)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
