import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  const getCurrentUserRecord = jest.fn();
  const findFirst = jest.fn();
  const update: jest.MockedFunction<
    (args: {
      data: {
        chapterLabel: string;
        completionPercent: number;
        currentLocator?: string;
        lastReadAt?: Date;
      };
      where: {
        libraryItemId: string;
      };
    }) => Promise<{
      chapterLabel: string;
      completionPercent: number;
      currentLocator: string;
      lastReadAt: Date;
    }>
  > = jest.fn();
  const updateLibraryItem = jest.fn();
  const prisma = {
    libraryItem: {
      findFirst,
      update: updateLibraryItem,
    },
    readingProgress: {
      update,
    },
  };
  const usersService = {
    getCurrentUserRecord,
  };
  let readerService: ReaderService;

  beforeEach(() => {
    getCurrentUserRecord.mockReset();
    findFirst.mockReset();
    update.mockReset();
    updateLibraryItem.mockReset();
    readerService = new ReaderService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
  });

  it('returns the chapter from the saved locator when no chapter query is provided', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.activeChapterId).toBe('chapter-2');
    expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
      'chapter-1',
      'chapter-2',
      'chapter-3',
    ]);
    expect(payload.progress.locator).toEqual({
      blockId: 'chapter-2::b1',
      chapterId: 'chapter-2',
      textOffset: 0,
    });
  });

  it('returns a centered three-chapter window for a middle chapter query', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
      'chapter-3',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.activeChapterId).toBe('chapter-3');
    expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
      'chapter-2',
      'chapter-3',
      'chapter-4',
    ]);
  });

  it('returns the active and next chapter when the first chapter is selected', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
      'chapter-1',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.activeChapterId).toBe('chapter-1');
    expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
      'chapter-1',
      'chapter-2',
    ]);
  });

  it('returns the previous and active chapter when the last chapter is selected', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
      'chapter-4',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.activeChapterId).toBe('chapter-4');
    expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
      'chapter-3',
      'chapter-4',
    ]);
  });

  it('falls back to the saved locator when the requested chapter does not exist', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
      'chapter-missing',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.activeChapterId).toBe('chapter-2');
    expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
      'chapter-1',
      'chapter-2',
      'chapter-3',
    ]);
    expect(payload.progress.locator).toEqual({
      blockId: 'chapter-2::b1',
      chapterId: 'chapter-2',
      textOffset: 0,
    });
  });

  it('updates progress from a structured locator and recomputes chapter metadata', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());
    update.mockResolvedValue({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
      lastReadAt: new Date('2026-04-07T12:00:00.000Z'),
    });
    updateLibraryItem.mockResolvedValue({});

    const progress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      },
    );

    const firstUpdateCall = update.mock.calls[0]?.[0];

    expect(firstUpdateCall?.where.libraryItemId).toBe('library-1');
    expect(firstUpdateCall?.data.chapterLabel).toBe('Chapter Two');
    expect(firstUpdateCall?.data.completionPercent).toBe(50);
    expect(progress).toEqual({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      lastReadAt: '2026-04-07T12:00:00.000Z',
      locator: {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      },
    });
  });

  it('returns stable progress when the same locator is saved repeatedly', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());
    update.mockResolvedValue({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
      lastReadAt: new Date('2026-04-07T12:00:00.000Z'),
    });
    updateLibraryItem.mockResolvedValue({});

    const firstProgress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      },
    );
    const secondProgress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      },
    );

    expect(firstProgress).toEqual(secondProgress);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0].data).toMatchObject({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
    });
    expect(update.mock.calls[1]?.[0].data).toMatchObject({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
    });
  });

  it('persists successive locators with different text offsets', async () => {
    findFirst.mockResolvedValue(createLibraryItemRecord());
    update
      .mockResolvedValueOnce({
        chapterLabel: 'Chapter Two',
        completionPercent: 50,
        currentLocator: JSON.stringify({
          blockId: 'chapter-2::b1',
          chapterId: 'chapter-2',
          textOffset: 214,
        }),
        lastReadAt: new Date('2026-04-07T12:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        chapterLabel: 'Chapter Two',
        completionPercent: 50,
        currentLocator: JSON.stringify({
          blockId: 'chapter-2::b1',
          chapterId: 'chapter-2',
          textOffset: 338,
        }),
        lastReadAt: new Date('2026-04-07T12:01:00.000Z'),
      });
    updateLibraryItem.mockResolvedValue({});

    const firstProgress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      },
    );
    const secondProgress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 338,
      },
    );

    expect(firstProgress.locator?.textOffset).toBe(214);
    expect(secondProgress.locator?.textOffset).toBe(338);
    expect(update.mock.calls[0]?.[0].data.currentLocator).toBe(
      JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
    );
    expect(update.mock.calls[1]?.[0].data.currentLocator).toBe(
      JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 338,
      }),
    );
  });
});

function createLibraryItemRecord() {
  const readerPackage = {
    version: 1 as const,
    manifest: {
      author: 'Example Author',
      language: 'en',
      sourceChecksum: 'checksum',
      title: 'Example Title',
      totalBlocks: 4,
      totalChapters: 4,
    },
    toc: [
      {
        chapterId: 'chapter-1',
        href: 'text/chapter-1.xhtml',
        label: 'Chapter One',
        spineIndex: 0,
      },
      {
        chapterId: 'chapter-2',
        href: 'text/chapter-2.xhtml',
        label: 'Chapter Two',
        spineIndex: 1,
      },
      {
        chapterId: 'chapter-3',
        href: 'text/chapter-3.xhtml',
        label: 'Chapter Three',
        spineIndex: 2,
      },
      {
        chapterId: 'chapter-4',
        href: 'text/chapter-4.xhtml',
        label: 'Chapter Four',
        spineIndex: 3,
      },
    ],
    chapters: [
      {
        blocks: [
          {
            id: 'chapter-1::b1',
            inlines: [{ kind: 'text' as const, text: 'One' }],
            kind: 'paragraph' as const,
            text: 'One',
          },
        ],
        chapterId: 'chapter-1',
        href: 'text/chapter-1.xhtml',
        label: 'Chapter One',
        nextChapterId: 'chapter-2',
        previousChapterId: null,
        spineIndex: 0,
        title: 'Chapter One',
      },
      {
        blocks: [
          {
            id: 'chapter-2::b1',
            inlines: [{ kind: 'text' as const, text: 'Two' }],
            kind: 'paragraph' as const,
            text: 'Two',
          },
        ],
        chapterId: 'chapter-2',
        href: 'text/chapter-2.xhtml',
        label: 'Chapter Two',
        nextChapterId: 'chapter-3',
        previousChapterId: 'chapter-1',
        spineIndex: 1,
        title: 'Chapter Two',
      },
      {
        blocks: [
          {
            id: 'chapter-3::b1',
            inlines: [{ kind: 'text' as const, text: 'Three' }],
            kind: 'paragraph' as const,
            text: 'Three',
          },
        ],
        chapterId: 'chapter-3',
        href: 'text/chapter-3.xhtml',
        label: 'Chapter Three',
        nextChapterId: 'chapter-4',
        previousChapterId: 'chapter-2',
        spineIndex: 2,
        title: 'Chapter Three',
      },
      {
        blocks: [
          {
            id: 'chapter-4::b1',
            inlines: [{ kind: 'text' as const, text: 'Four' }],
            kind: 'paragraph' as const,
            text: 'Four',
          },
        ],
        chapterId: 'chapter-4',
        href: 'text/chapter-4.xhtml',
        label: 'Chapter Four',
        nextChapterId: null,
        previousChapterId: 'chapter-3',
        spineIndex: 3,
        title: 'Chapter Four',
      },
    ],
  };

  return {
    id: 'library-1',
    progress: {
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 0,
      }),
      lastReadAt: new Date('2026-04-07T10:00:00.000Z'),
    },
    book: {
      author: 'Example Author',
      title: 'Example Title',
      files: [
        {
          blob: {
            bytes: Buffer.from(JSON.stringify(readerPackage), 'utf8'),
          },
          format: BookFileFormat.READER_PACKAGE,
          isPrimary: true,
          kind: BookFileKind.DERIVED_READER,
          processingStatus: ProcessingStatus.READY,
        },
        {
          blob: {
            bytes: Buffer.from('epub'),
          },
          format: BookFileFormat.EPUB,
          isPrimary: true,
          kind: BookFileKind.SOURCE,
          processingStatus: ProcessingStatus.READY,
        },
      ],
      processingRuns: [],
    },
  };
}
