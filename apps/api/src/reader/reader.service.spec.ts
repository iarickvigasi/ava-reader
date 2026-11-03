import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { __resetReaderPackageCacheForTesting } from './package/reader-package-cache';
import { buildReadingProgressIndex } from './progress/reading-progress-index';
import { ReaderService } from './reader.service';
import type { ReaderPackage } from './reader-types';

function getFirstCallArg<T>(fn: { mock: { calls: unknown[] } }): T {
  return (fn.mock.calls as Array<[T]>)[0][0];
}

describe('ReaderService', () => {
  const getCurrentUserRecord = jest.fn();
  const findFirstLibraryItem = jest.fn();
  const findUniqueOrThrowStoredBlob = jest.fn();
  const updateBookFile = jest.fn();
  const updateLibraryItem = jest.fn();
  const updateReadingProgress = jest.fn();
  const findUniqueBookAnalysis = jest.fn();
  const findFirstBookProcessingRun = jest.fn();
  const createBookProcessingRun = jest.fn();

  const prisma = {
    bookAnalysis: {
      findUnique: findUniqueBookAnalysis,
    },
    bookFile: {
      update: updateBookFile,
    },
    bookProcessingRun: {
      create: createBookProcessingRun,
      findFirst: findFirstBookProcessingRun,
    },
    libraryItem: {
      findFirst: findFirstLibraryItem,
      update: updateLibraryItem,
    },
    readingProgress: {
      update: updateReadingProgress,
    },
    storedBlob: {
      findUniqueOrThrow: findUniqueOrThrowStoredBlob,
    },
  };

  const usersService = {
    getCurrentUserRecord,
  };
  let readerService: ReaderService;

  beforeEach(() => {
    __resetReaderPackageCacheForTesting();
    getCurrentUserRecord.mockReset();
    findFirstLibraryItem.mockReset();
    // No analysis on record and no run in flight — the enqueue path's
    // "this book needs analysing" case.
    findUniqueBookAnalysis.mockReset();
    findUniqueBookAnalysis.mockResolvedValue(null);
    findFirstBookProcessingRun.mockReset();
    findFirstBookProcessingRun.mockResolvedValue(null);
    createBookProcessingRun.mockReset();
    createBookProcessingRun.mockResolvedValue({ id: 'run-1' });
    findUniqueOrThrowStoredBlob.mockReset();
    findUniqueOrThrowStoredBlob.mockImplementation(() =>
      Promise.resolve({
        bytes: Buffer.from(JSON.stringify(createReaderPackage()), 'utf8'),
      }),
    );
    updateBookFile.mockReset();
    updateBookFile.mockResolvedValue({});
    updateLibraryItem.mockReset();
    updateReadingProgress.mockReset();
    readerService = new ReaderService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Lazy analysis (specs/8-chapter-purpose-analysis): a bulk import costs
  // nothing, only the books someone actually opens are analysed. The enqueue is
  // fire-and-forget, hence the microtask flush.
  describe('chapter-purpose analysis enqueue', () => {
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it('queues a run the first time a book is read', async () => {
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());

      await readerService.getReaderPayload('clerk_1', 'library-1');
      await flush();

      expect(createBookProcessingRun).toHaveBeenCalledTimes(1);
      expect(
        getFirstCallArg<{ data: unknown }>(createBookProcessingRun),
      ).toEqual({ data: { bookId: 'book-1', pipeline: 'chapter-purpose-v1' } });
    });

    it('does not queue when a fresh analysis already exists', async () => {
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findUniqueBookAnalysis.mockResolvedValue({
        attempts: 0,
        readerFileId: 'file-derived-reader',
        status: ProcessingStatus.READY,
      });

      await readerService.getReaderPayload('clerk_1', 'library-1');
      await flush();

      expect(createBookProcessingRun).not.toHaveBeenCalled();
    });

    // A result tied to a superseded reader file is stale, not fresh:
    // reprocessing shifted the chapter ids underneath it.
    it('re-queues when the analysis belongs to a superseded reader file', async () => {
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findUniqueBookAnalysis.mockResolvedValue({
        attempts: 0,
        readerFileId: 'file-from-a-previous-import',
        status: ProcessingStatus.READY,
      });

      await readerService.getReaderPayload('clerk_1', 'library-1');
      await flush();

      expect(createBookProcessingRun).toHaveBeenCalledTimes(1);
    });

    it('stops queueing once the retry cap is reached', async () => {
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findUniqueBookAnalysis.mockResolvedValue({
        attempts: 3,
        readerFileId: 'file-derived-reader',
        status: ProcessingStatus.FAILED,
      });

      await readerService.getReaderPayload('clerk_1', 'library-1');
      await flush();

      expect(createBookProcessingRun).not.toHaveBeenCalled();
    });

    it('still serves the payload when queueing fails, and says so', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findUniqueBookAnalysis.mockRejectedValue(new Error('database is down'));

      const payload = await readerService.getReaderPayload(
        'clerk_1',
        'library-1',
      );
      await flush();

      expect(payload.status).toBe('READY');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('database is down'),
      );
      warn.mockRestore();
    });
  });

  it('returns the chapter from the saved locator when no chapter query is provided', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());

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
  });

  it('keeps persisted named entities, block text and ids unchanged when decoding legacy numeric labels', async () => {
    const storedPackage = createReaderPackage({
      tocMode: 'nested',
    });
    storedPackage.toc[0].label = 'Chapter One&#8217;s&nbsp;Story';
    storedPackage.chapters[0].label = 'Chapter One&#8217;s&nbsp;Story';
    storedPackage.chapters[0].title = 'Chapter One&#8217;s&nbsp;Story';
    storedPackage.chapters[0].blocks[0].text =
      'Literal &#8217; &nbsp; body text';
    findUniqueOrThrowStoredBlob.mockResolvedValue({
      bytes: Buffer.from(JSON.stringify(storedPackage), 'utf8'),
    });
    const libraryItem = createLibraryItemRecord();
    libraryItem.progress.chapterLabel = 'Chapter Two&#8217;s&nbsp;Story';
    findFirstLibraryItem.mockResolvedValue(libraryItem);

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.toc[0]?.label).toBe('Chapter One’s&nbsp;Story');
    expect(payload.progress.chapterLabel).toBe('Chapter Two’s&nbsp;Story');
    expect(payload.chapters[0]).toMatchObject({
      chapterId: 'chapter-1',
      label: 'Chapter One’s&nbsp;Story',
      title: 'Chapter One’s&nbsp;Story',
    });
    expect(payload.chapters[0]?.blocks[0]).toMatchObject({
      id: 'chapter-1::b1',
      text: 'Literal &#8217; &nbsp; body text',
    });
  });

  it('updates progress from a structured locator and recomputes chapter metadata', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    updateReadingProgress.mockResolvedValue({
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
    const updateLibraryItemCall = getFirstCallArg<{
      data: { lastOpenedAt: Date };
      where: { id: string };
    }>(updateLibraryItem);
    expect(updateLibraryItemCall.where.id).toBe('library-1');
    expect(updateLibraryItemCall.data.lastOpenedAt).toBeInstanceOf(Date);
  });

  it('applies a progress write and stamps the client readAt as lastReadAt', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    updateReadingProgress.mockResolvedValue({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 214,
      }),
      lastReadAt: new Date('2026-04-08T09:00:00.000Z'),
    });
    updateLibraryItem.mockResolvedValue({});

    // readAt (2026-04-08) is newer than the stored lastReadAt (2026-04-07).
    const progress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      { blockId: 'chapter-2::b1', chapterId: 'chapter-2', textOffset: 214 },
      '2026-04-08T09:00:00.000Z',
    );

    const call = getFirstCallArg<{
      data: { currentLocator: string; lastReadAt: Date };
    }>(updateReadingProgress);
    expect(call.data.lastReadAt).toEqual(new Date('2026-04-08T09:00:00.000Z'));
    expect(progress.lastReadAt).toBe('2026-04-08T09:00:00.000Z');
  });

  it('ignores a stale progress write and returns the stored (newer) position', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());

    // readAt (2026-04-06) is older than the stored lastReadAt (2026-04-07):
    // another device already read further, so this write must not win.
    const progress = await readerService.updateProgress(
      'clerk_1',
      'library-1',
      { blockId: 'chapter-9::b1', chapterId: 'chapter-9', textOffset: 5 },
      '2026-04-06T00:00:00.000Z',
    );

    expect(updateReadingProgress).not.toHaveBeenCalled();
    expect(progress).toEqual({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      lastReadAt: '2026-04-07T10:00:00.000Z',
      locator: {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 0,
      },
    });
  });

  it('returns the current reading progress summary for an owned item', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());

    const progress = await readerService.getProgress('clerk_1', 'library-1');

    expect(progress).toEqual({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      lastReadAt: '2026-04-07T10:00:00.000Z',
      locator: {
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 0,
      },
    });
  });

  it('lazily back-fills the progress index for legacy derived-reader rows', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    updateReadingProgress.mockResolvedValue({
      chapterLabel: 'Chapter Two',
      completionPercent: 50,
      currentLocator: JSON.stringify({
        blockId: 'chapter-2::b1',
        chapterId: 'chapter-2',
        textOffset: 0,
      }),
      lastReadAt: new Date('2026-04-07T12:00:00.000Z'),
    });
    updateLibraryItem.mockResolvedValue({});

    await readerService.updateProgress('clerk_1', 'library-1', {
      blockId: 'chapter-2::b1',
      chapterId: 'chapter-2',
      textOffset: 0,
    });

    // Wait for the fire-and-forget back-fill to settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateBookFile).toHaveBeenCalledTimes(1);
    const backfillCall = getFirstCallArg<{
      data: {
        readingProgressIndex: { chapters: unknown[]; totalBlocks: number };
      };
      where: { id: string };
    }>(updateBookFile);
    expect(backfillCall.where.id).toBe('file-derived-reader');
    expect(backfillCall.data.readingProgressIndex.totalBlocks).toBe(4);
    expect(backfillCall.data.readingProgressIndex.chapters).toHaveLength(4);
  });

  it('marks a reader as opened by updating lastOpenedAt', async () => {
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    updateLibraryItem.mockResolvedValue({});

    await readerService.markReaderOpened('clerk_1', 'library-1');

    const markReaderOpenedCall = getFirstCallArg<{
      data: { lastOpenedAt: Date };
      where: { id: string };
    }>(updateLibraryItem);
    expect(markReaderOpenedCall.where.id).toBe('library-1');
    expect(markReaderOpenedCall.data.lastOpenedAt).toBeInstanceOf(Date);
  });
});

describe('buildReadingProgressIndex', () => {
  it('captures totals, per-chapter block ids, and the toc', () => {
    const readerPackage = {
      version: 2,
      manifest: {
        authors: [],
        language: null,
        sourceChecksum: 'c',
        title: 't',
        totalBlocks: 3,
        totalChapters: 2,
      },
      toc: [
        {
          anchorId: null,
          blockId: null,
          chapterId: 'chapter-1',
          children: [],
          href: 'c1.xhtml',
          id: 'toc:0',
          label: 'Chapter One',
          spineIndex: 0,
        },
      ],
      chapters: [
        {
          blocks: [
            {
              id: 'chapter-1::b1',
              inlines: [],
              kind: 'paragraph' as const,
              text: 'a',
            },
          ],
          chapterId: 'chapter-1',
          href: 'c1.xhtml',
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
              inlines: [],
              kind: 'paragraph' as const,
              text: 'b',
            },
            {
              id: 'chapter-2::b2',
              inlines: [],
              kind: 'paragraph' as const,
              text: 'c',
            },
          ],
          chapterId: 'chapter-2',
          href: 'c2.xhtml',
          label: 'Chapter Two',
          nextChapterId: null,
          previousChapterId: 'chapter-1',
          spineIndex: 1,
          title: 'Chapter Two',
        },
      ],
    } satisfies ReaderPackage;

    const index = buildReadingProgressIndex(readerPackage);

    expect(index.version).toBe(1);
    expect(index.totalBlocks).toBe(3);
    expect(index.toc).toEqual(readerPackage.toc);
    expect(index.chapters).toEqual([
      {
        blockIds: ['chapter-1::b1'],
        chapterId: 'chapter-1',
        label: 'Chapter One',
        title: 'Chapter One',
      },
      {
        blockIds: ['chapter-2::b1', 'chapter-2::b2'],
        chapterId: 'chapter-2',
        label: 'Chapter Two',
        title: 'Chapter Two',
      },
    ]);
  });
});

function createReaderPackage(input?: { tocMode?: 'flat' | 'nested' }) {
  const tocMode = input?.tocMode ?? 'flat';
  return {
    version: 2 as const,
    manifest: {
      authors: ['Example Author'],
      language: 'en',
      sourceChecksum: 'checksum',
      title: 'Example Title',
      totalBlocks: tocMode === 'nested' ? 5 : 4,
      totalChapters: 4,
    },
    toc:
      tocMode === 'nested'
        ? [
            {
              anchorId: null,
              blockId: null,
              chapterId: 'chapter-1',
              children: [],
              href: 'text/chapter-1.xhtml',
              id: 'toc:0',
              label: 'Chapter One',
              spineIndex: 0,
            },
            {
              anchorId: null,
              blockId: null,
              chapterId: 'chapter-2',
              children: [
                {
                  anchorId: 'section-two',
                  blockId: 'chapter-2::b2',
                  chapterId: 'chapter-2',
                  children: [],
                  href: 'text/chapter-2.xhtml#section-two',
                  id: 'toc:1.0',
                  label: 'Section Two',
                  spineIndex: 1,
                },
              ],
              href: 'text/chapter-2.xhtml',
              id: 'toc:1',
              label: 'Chapter Two',
              spineIndex: 1,
            },
            {
              anchorId: null,
              blockId: null,
              chapterId: 'chapter-3',
              children: [],
              href: 'text/chapter-3.xhtml',
              id: 'toc:2',
              label: 'Chapter Three',
              spineIndex: 2,
            },
            {
              anchorId: null,
              blockId: null,
              chapterId: 'chapter-4',
              children: [],
              href: 'text/chapter-4.xhtml',
              id: 'toc:3',
              label: 'Chapter Four',
              spineIndex: 3,
            },
          ]
        : [
            {
              anchorId: null,
              blockId: null,
              children: [],
              id: 'toc:0',
              chapterId: 'chapter-1',
              href: 'text/chapter-1.xhtml',
              label: 'Chapter One',
              spineIndex: 0,
            },
            {
              anchorId: null,
              blockId: null,
              children: [],
              id: 'toc:1',
              chapterId: 'chapter-2',
              href: 'text/chapter-2.xhtml',
              label: 'Chapter Two',
              spineIndex: 1,
            },
            {
              anchorId: null,
              blockId: null,
              children: [],
              id: 'toc:2',
              chapterId: 'chapter-3',
              href: 'text/chapter-3.xhtml',
              label: 'Chapter Three',
              spineIndex: 2,
            },
            {
              anchorId: null,
              blockId: null,
              children: [],
              id: 'toc:3',
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
          {
            anchorId: 'section-two',
            id: 'chapter-2::b2',
            inlines: [{ kind: 'text' as const, text: 'Section Two' }],
            kind: 'heading' as const,
            level: 2,
            text: 'Section Two',
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
}

function createLibraryItemRecord() {
  // `readingProgressIndex` is left null so the lazy back-fill path is exercised in
  // tests; the runtime fast path (index already populated) is covered by the
  // unit test for `buildReadingProgressIndex` below.
  return {
    id: 'library-1',
    userId: 'user-1',
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
      id: 'book-1',
      authors: ['Example Author'],
      title: 'Example Title',
      files: [
        {
          id: 'file-derived-reader',
          blobId: 'blob-derived-reader',
          format: BookFileFormat.READER_PACKAGE,
          isPrimary: true,
          kind: BookFileKind.DERIVED_READER,
          processingStatus: ProcessingStatus.READY,
          readingProgressIndex: null,
        },
        {
          id: 'file-source-epub',
          blobId: 'blob-source-epub',
          format: BookFileFormat.EPUB,
          isPrimary: true,
          kind: BookFileKind.SOURCE,
          processingStatus: ProcessingStatus.READY,
          readingProgressIndex: null,
        },
      ],
      processingRuns: [],
    },
  };
}
