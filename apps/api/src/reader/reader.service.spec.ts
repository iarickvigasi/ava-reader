import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import { BadRequestException, Logger } from '@nestjs/common';
import {
  ReaderService,
  __resetReaderPackageCacheForTesting,
  buildReadingProgressIndex,
} from './reader.service';
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
  const updateManyReadingProgress = jest.fn();
  const createReadingSession = jest.fn();
  const findFirstReadingSession = jest.fn();
  const updateReadingSession = jest.fn();
  const updateManyReadingSessionParticipant = jest.fn();
  const countReadingSessionParticipant = jest.fn();
  const upsertReadingSessionParticipant = jest.fn();
  const upsertReadingSessionSegment = jest.fn();
  const aggregateReadingSessionSegment = jest.fn();
  const queryRaw = jest.fn();
  // Reading a book lazily enqueues its chapter-purpose analysis
  // (see specs/18-chapter-purpose-analysis). Stubbed so the reader payload
  // tests exercise that path instead of silently swallowing a mock failure.
  const findUniqueBookAnalysis = jest.fn();
  const findFirstBookProcessingRun = jest.fn();
  const createBookProcessingRun = jest.fn();

  const tx = {
    $queryRaw: queryRaw,
    readingProgress: {
      updateMany: updateManyReadingProgress,
    },
    readingSession: {
      create: createReadingSession,
      findFirst: findFirstReadingSession,
      update: updateReadingSession,
    },
    readingSessionParticipant: {
      count: countReadingSessionParticipant,
      updateMany: updateManyReadingSessionParticipant,
      upsert: upsertReadingSessionParticipant,
    },
    readingSessionSegment: {
      aggregate: aggregateReadingSessionSegment,
      upsert: upsertReadingSessionSegment,
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
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
    updateManyReadingProgress.mockReset();
    createReadingSession.mockReset();
    findFirstReadingSession.mockReset();
    updateReadingSession.mockReset();
    updateManyReadingSessionParticipant.mockReset();
    countReadingSessionParticipant.mockReset();
    upsertReadingSessionParticipant.mockReset();
    upsertReadingSessionSegment.mockReset();
    aggregateReadingSessionSegment.mockReset();
    queryRaw.mockReset();
    prisma.$transaction.mockClear();
    readerService = new ReaderService(prisma as never, usersService as never);
    getCurrentUserRecord.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Lazy analysis (specs/18-chapter-purpose-analysis): a bulk import costs
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

  it('decodes persisted display labels without changing block text or ids', async () => {
    const storedPackage = createReaderPackage({
      tocMode: 'nested',
      version: 2,
    });
    storedPackage.toc[0].label = 'Chapter One&#8217;s Story';
    storedPackage.chapters[0].label = 'Chapter One&#8217;s Story';
    storedPackage.chapters[0].title = 'Chapter One&#8217;s Story';
    storedPackage.chapters[0].blocks[0].text = 'Literal &#8217; body text';
    findUniqueOrThrowStoredBlob.mockResolvedValue({
      bytes: Buffer.from(JSON.stringify(storedPackage), 'utf8'),
    });
    const libraryItem = createLibraryItemRecord();
    libraryItem.progress.chapterLabel = 'Chapter Two&#8217;s Story';
    findFirstLibraryItem.mockResolvedValue(libraryItem);

    const payload = await readerService.getReaderPayload(
      'clerk_1',
      'library-1',
    );

    expect(payload.status).toBe('READY');
    if (payload.status !== 'READY') {
      throw new Error('Expected READY payload');
    }

    expect(payload.toc[0]?.label).toBe('Chapter One’s Story');
    expect(payload.progress.chapterLabel).toBe('Chapter Two’s Story');
    expect(payload.chapters[0]).toMatchObject({
      chapterId: 'chapter-1',
      label: 'Chapter One’s Story',
      title: 'Chapter One’s Story',
    });
    expect(payload.chapters[0]?.blocks[0]).toMatchObject({
      id: 'chapter-1::b1',
      text: 'Literal &#8217; body text',
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

  it('starts a new session and registers the device participant', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:00:00.000Z').getTime());
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    queryRaw.mockResolvedValueOnce([]);
    createReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 0,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:00.000Z'),
        startedAt: new Date('2026-04-12T10:00:00.000Z'),
      }),
    );
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    upsertReadingSessionParticipant.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 0,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:00.000Z'),
        startedAt: new Date('2026-04-12T10:00:00.000Z'),
      }),
    );

    const session = await readerService.startSession(
      'clerk_1',
      'library-1',
      'client-a',
    );

    const createReadingSessionCall = getFirstCallArg<{
      data: {
        durationMinutes: number;
        durationSeconds: number;
        libraryItemId: string;
        userId: string;
      };
      select: unknown;
    }>(createReadingSession);
    expect(createReadingSessionCall.data.durationMinutes).toBe(0);
    expect(createReadingSessionCall.data.durationSeconds).toBe(0);
    expect(createReadingSessionCall.data.libraryItemId).toBe('library-1');
    expect(createReadingSessionCall.data.userId).toBe('user-1');
    expect(createReadingSessionCall.select).toBeDefined();
    const participantUpsertCall = getFirstCallArg<{
      create: {
        clientInstanceId: string;
        stoppedAt: Date | null;
      };
      update: {
        lastSeenAt: Date;
        stoppedAt: Date | null;
      };
      where: {
        readingSessionId_clientInstanceId: {
          clientInstanceId: string;
          readingSessionId: string;
        };
      };
    }>(upsertReadingSessionParticipant);
    expect(participantUpsertCall.create.clientInstanceId).toBe('client-a');
    expect(participantUpsertCall.create.stoppedAt).toBeNull();
    expect(participantUpsertCall.update.lastSeenAt).toBeInstanceOf(Date);
    expect(participantUpsertCall.update.stoppedAt).toBeNull();
    expect(
      participantUpsertCall.where.readingSessionId_clientInstanceId,
    ).toEqual({
      clientInstanceId: 'client-a',
      readingSessionId: 'session-1',
    });
    expect(session).toEqual({
      durationSeconds: 0,
      endedAt: null,
      lastTrackedAt: '2026-04-12T10:00:00.000Z',
      sessionId: 'session-1',
      startedAt: '2026-04-12T10:00:00.000Z',
    });
  });

  describe('offline session replay', () => {
    const REPLAY = {
      clientSessionId: 'csid-1',
      // A 30-minute session that happened three days before "now".
      startedAt: '2026-06-26T08:00:00.000Z',
      endedAt: '2026-06-26T08:30:00.000Z',
    };

    function setNowAfterReplay() {
      jest
        .useFakeTimers()
        .setSystemTime(new Date('2026-06-29T12:00:00.000Z').getTime());
    }

    it('persists original timestamps and real duration without reopening or re-dating', async () => {
      setNowAfterReplay();
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findFirstReadingSession.mockResolvedValue(null);
      createReadingSession.mockResolvedValue(
        createLockedSessionRecord({
          durationSeconds: 1_800,
          endedAt: new Date(REPLAY.endedAt),
          lastTrackedAt: new Date(REPLAY.endedAt),
          startedAt: new Date(REPLAY.startedAt),
          trackedDay: new Date('2026-06-26T00:00:00.000Z'),
        }),
      );
      upsertReadingSessionSegment.mockResolvedValue({});
      aggregateReadingSessionSegment.mockResolvedValue({
        _sum: { durationSeconds: 1_800 },
      });
      updateManyReadingProgress.mockResolvedValue({ count: 1 });

      const session = await readerService.startSession(
        'clerk_1',
        'library-1',
        'client-a',
        REPLAY,
      );

      const createCall = getFirstCallArg<{
        data: {
          clientSessionId: string;
          durationMinutes: number;
          durationSeconds: number;
          endedAt: Date;
          lastTrackedAt: Date;
          startedAt: Date;
          trackedDay: Date;
        };
      }>(createReadingSession);
      expect(createCall.data.durationSeconds).toBe(1_800);
      expect(createCall.data.durationMinutes).toBe(30);
      expect(createCall.data.clientSessionId).toBe('csid-1');
      expect(createCall.data.endedAt.toISOString()).toBe(REPLAY.endedAt);
      expect(createCall.data.startedAt.toISOString()).toBe(REPLAY.startedAt);
      expect(createCall.data.lastTrackedAt.toISOString()).toBe(REPLAY.endedAt);
      expect(createCall.data.trackedDay.toISOString()).toBe(
        '2026-06-26T00:00:00.000Z',
      );

      // No 'start' action: the row is never reopened or re-dated to "now".
      expect(updateReadingSession).not.toHaveBeenCalled();
      expect(upsertReadingSessionParticipant).not.toHaveBeenCalled();

      expect(session.endedAt).toBe(REPLAY.endedAt);
      expect(session.durationSeconds).toBe(1_800);
    });

    it('writes per-UTC-day segments and syncs progress minutes', async () => {
      setNowAfterReplay();
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findFirstReadingSession.mockResolvedValue(null);
      createReadingSession.mockResolvedValue(
        createLockedSessionRecord({
          durationSeconds: 1_800,
          endedAt: new Date(REPLAY.endedAt),
          startedAt: new Date(REPLAY.startedAt),
        }),
      );
      upsertReadingSessionSegment.mockResolvedValue({});
      aggregateReadingSessionSegment.mockResolvedValue({
        _sum: { durationSeconds: 1_800 },
      });
      updateManyReadingProgress.mockResolvedValue({ count: 1 });

      await readerService.startSession(
        'clerk_1',
        'library-1',
        'client-a',
        REPLAY,
      );

      expect(upsertReadingSessionSegment).toHaveBeenCalledTimes(1);
      const segmentCall = getFirstCallArg<{
        create: { durationSeconds: number; trackedDay: Date };
      }>(upsertReadingSessionSegment);
      expect(segmentCall.create.durationSeconds).toBe(1_800);
      expect(segmentCall.create.trackedDay.toISOString()).toBe(
        '2026-06-26T00:00:00.000Z',
      );
      expect(updateManyReadingProgress).toHaveBeenCalledWith({
        data: { minutesRead: 30 },
        where: { libraryItemId: 'library-1', userId: 'user-1' },
      });
    });

    it('is idempotent: a retried replay returns the existing row unchanged', async () => {
      setNowAfterReplay();
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findFirstReadingSession.mockResolvedValue(
        createLockedSessionRecord({
          durationSeconds: 1_800,
          endedAt: new Date(REPLAY.endedAt),
          lastTrackedAt: new Date(REPLAY.endedAt),
          startedAt: new Date(REPLAY.startedAt),
          trackedDay: new Date('2026-06-26T00:00:00.000Z'),
        }),
      );

      const session = await readerService.startSession(
        'clerk_1',
        'library-1',
        'client-a',
        REPLAY,
      );

      expect(createReadingSession).not.toHaveBeenCalled();
      expect(updateReadingSession).not.toHaveBeenCalled();
      expect(upsertReadingSessionSegment).not.toHaveBeenCalled();
      expect(updateManyReadingProgress).not.toHaveBeenCalled();
      expect(session.endedAt).toBe(REPLAY.endedAt);
      expect(session.durationSeconds).toBe(1_800);
    });

    it('clamps an over-cap span to 24h and logs a warning', async () => {
      setNowAfterReplay();
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
      findFirstReadingSession.mockResolvedValue(null);
      createReadingSession.mockResolvedValue(
        createLockedSessionRecord({
          durationSeconds: 86_400,
          endedAt: new Date('2026-06-27T14:00:00.000Z'),
          startedAt: new Date('2026-06-26T08:00:00.000Z'),
        }),
      );
      upsertReadingSessionSegment.mockResolvedValue({});
      aggregateReadingSessionSegment.mockResolvedValue({
        _sum: { durationSeconds: 86_400 },
      });
      updateManyReadingProgress.mockResolvedValue({ count: 1 });

      await readerService.startSession('clerk_1', 'library-1', 'client-a', {
        clientSessionId: 'csid-2',
        // 30 hours apart -> exceeds the 24h cap.
        startedAt: '2026-06-26T08:00:00.000Z',
        endedAt: '2026-06-27T14:00:00.000Z',
      });

      const createCall = getFirstCallArg<{
        data: { durationMinutes: number; durationSeconds: number };
      }>(createReadingSession);
      expect(createCall.data.durationSeconds).toBe(86_400);
      expect(createCall.data.durationMinutes).toBe(1_440);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('rejects an unparseable timestamp with a 400', async () => {
      setNowAfterReplay();
      await expect(
        readerService.startSession('clerk_1', 'library-1', 'client-a', {
          clientSessionId: 'csid-3',
          startedAt: 'garbage',
          endedAt: REPLAY.endedAt,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createReadingSession).not.toHaveBeenCalled();
    });

    it('rejects endedAt before startedAt with a 400', async () => {
      setNowAfterReplay();
      await expect(
        readerService.startSession('clerk_1', 'library-1', 'client-a', {
          clientSessionId: 'csid-4',
          startedAt: REPLAY.endedAt,
          endedAt: REPLAY.startedAt,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createReadingSession).not.toHaveBeenCalled();
    });
  });

  it('shares one active session across multiple devices and increments wall-clock once', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:00:10.000Z').getTime());
    findFirstLibraryItem.mockResolvedValue(createLibraryItemRecord());
    queryRaw.mockResolvedValueOnce([
      createLockedSessionRecord({
        durationSeconds: 120,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:00.000Z'),
        startedAt: new Date('2026-04-12T09:58:00.000Z'),
      }),
    ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    upsertReadingSessionParticipant.mockResolvedValue({});
    upsertReadingSessionSegment.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 130,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:10.000Z'),
        startedAt: new Date('2026-04-12T09:58:00.000Z'),
      }),
    );
    aggregateReadingSessionSegment.mockResolvedValue({
      _sum: {
        durationSeconds: 3_900,
      },
    });
    updateManyReadingProgress.mockResolvedValue({ count: 1 });

    const session = await readerService.startSession(
      'clerk_1',
      'library-1',
      'client-b',
    );

    expect(createReadingSession).not.toHaveBeenCalled();
    expect(upsertReadingSessionSegment).toHaveBeenCalledTimes(1);
    expect(updateManyReadingProgress).toHaveBeenCalledWith({
      data: {
        minutesRead: 65,
      },
      where: {
        libraryItemId: 'library-1',
        userId: 'user-1',
      },
    });
    expect(session.durationSeconds).toBe(130);
  });

  it('does not double-count when heartbeats race on the same session', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:00:30.000Z').getTime());
    queryRaw
      .mockResolvedValueOnce([
        createLockedSessionRecord({
          durationSeconds: 120,
          endedAt: null,
          lastTrackedAt: new Date('2026-04-12T10:00:00.000Z'),
        }),
      ])
      .mockResolvedValueOnce([
        createLockedSessionRecord({
          durationSeconds: 150,
          endedAt: null,
          lastTrackedAt: new Date('2026-04-12T10:00:30.000Z'),
        }),
      ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    upsertReadingSessionParticipant.mockResolvedValue({});
    upsertReadingSessionSegment.mockResolvedValue({});
    updateReadingSession
      .mockResolvedValueOnce(
        createLockedSessionRecord({
          durationSeconds: 150,
          endedAt: null,
          lastTrackedAt: new Date('2026-04-12T10:00:30.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        createLockedSessionRecord({
          durationSeconds: 150,
          endedAt: null,
          lastTrackedAt: new Date('2026-04-12T10:00:30.000Z'),
        }),
      );
    aggregateReadingSessionSegment.mockResolvedValue({
      _sum: {
        durationSeconds: 7_200,
      },
    });
    updateManyReadingProgress.mockResolvedValue({ count: 1 });

    const firstHeartbeat = await readerService.heartbeatSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );
    const secondHeartbeat = await readerService.heartbeatSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-b',
    );

    expect(upsertReadingSessionSegment).toHaveBeenCalledTimes(1);
    expect(firstHeartbeat.durationSeconds).toBe(150);
    expect(secondHeartbeat.durationSeconds).toBe(150);
  });

  it('keeps session active when one participant stops and another is still active', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:00:45.000Z').getTime());
    queryRaw.mockResolvedValueOnce([
      createLockedSessionRecord({
        durationSeconds: 150,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:30.000Z'),
      }),
    ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    upsertReadingSessionParticipant.mockResolvedValue({});
    upsertReadingSessionSegment.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 165,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:45.000Z'),
      }),
    );
    aggregateReadingSessionSegment.mockResolvedValue({
      _sum: {
        durationSeconds: 7_500,
      },
    });
    updateManyReadingProgress.mockResolvedValue({ count: 1 });

    const session = await readerService.stopSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );

    expect(session.endedAt).toBeNull();
    const stopParticipantUpsertCall = getFirstCallArg<{
      create: {
        clientInstanceId: string;
        stoppedAt: Date | null;
      };
      update: {
        lastSeenAt: Date;
        stoppedAt: Date | null;
      };
      where: {
        readingSessionId_clientInstanceId: {
          clientInstanceId: string;
          readingSessionId: string;
        };
      };
    }>(upsertReadingSessionParticipant);
    expect(stopParticipantUpsertCall.create.clientInstanceId).toBe('client-a');
    expect(stopParticipantUpsertCall.create.stoppedAt).toBeInstanceOf(Date);
    expect(stopParticipantUpsertCall.update.lastSeenAt).toBeInstanceOf(Date);
    expect(stopParticipantUpsertCall.update.stoppedAt).toBeInstanceOf(Date);
    expect(
      stopParticipantUpsertCall.where.readingSessionId_clientInstanceId,
    ).toEqual({
      clientInstanceId: 'client-a',
      readingSessionId: 'session-1',
    });
  });

  it('ends the shared session when the last participant stops', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:01:00.000Z').getTime());
    queryRaw.mockResolvedValueOnce([
      createLockedSessionRecord({
        durationSeconds: 165,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:45.000Z'),
      }),
    ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    upsertReadingSessionParticipant.mockResolvedValue({});
    upsertReadingSessionSegment.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 180,
        endedAt: new Date('2026-04-12T10:01:00.000Z'),
        lastTrackedAt: new Date('2026-04-12T10:01:00.000Z'),
      }),
    );
    aggregateReadingSessionSegment.mockResolvedValue({
      _sum: {
        durationSeconds: 7_680,
      },
    });
    updateManyReadingProgress.mockResolvedValue({ count: 1 });

    const session = await readerService.stopSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-b',
    );

    expect(session.endedAt).toBe('2026-04-12T10:01:00.000Z');
    expect(session.durationSeconds).toBe(180);
  });

  it('splits elapsed seconds across UTC day boundaries', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-11T00:00:15.000Z').getTime());
    queryRaw.mockResolvedValueOnce([
      createLockedSessionRecord({
        durationSeconds: 900,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-10T23:59:45.000Z'),
      }),
    ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 0 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    upsertReadingSessionParticipant.mockResolvedValue({});
    upsertReadingSessionSegment.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 930,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-11T00:00:15.000Z'),
      }),
    );
    aggregateReadingSessionSegment.mockResolvedValue({
      _sum: {
        durationSeconds: 5_430,
      },
    });
    updateManyReadingProgress.mockResolvedValue({ count: 1 });

    await readerService.heartbeatSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );

    expect(upsertReadingSessionSegment).toHaveBeenCalledTimes(2);
    const segmentUpsertCalls = upsertReadingSessionSegment.mock.calls as Array<
      [
        {
          create: {
            durationSeconds: number;
            trackedDay: Date;
          };
        },
      ]
    >;
    const firstSegmentCall = segmentUpsertCalls[0][0];
    const secondSegmentCall = segmentUpsertCalls[1][0];
    expect(firstSegmentCall.create.durationSeconds).toBe(15);
    expect(secondSegmentCall.create.durationSeconds).toBe(15);
    expect(firstSegmentCall.create.trackedDay.toISOString()).toBe(
      '2026-04-10T00:00:00.000Z',
    );
    expect(secondSegmentCall.create.trackedDay.toISOString()).toBe(
      '2026-04-11T00:00:00.000Z',
    );
  });

  it('expires stale participants and avoids adding stale elapsed time', async () => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-04-12T10:10:00.000Z').getTime());
    queryRaw.mockResolvedValueOnce([
      createLockedSessionRecord({
        durationSeconds: 300,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:00:00.000Z'),
      }),
    ]);
    updateManyReadingSessionParticipant.mockResolvedValue({ count: 1 });
    countReadingSessionParticipant
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    upsertReadingSessionParticipant.mockResolvedValue({});
    updateReadingSession.mockResolvedValue(
      createLockedSessionRecord({
        durationSeconds: 300,
        endedAt: null,
        lastTrackedAt: new Date('2026-04-12T10:10:00.000Z'),
      }),
    );

    const session = await readerService.heartbeatSession(
      'clerk_1',
      'library-1',
      'session-1',
      'client-a',
    );

    expect(upsertReadingSessionSegment).not.toHaveBeenCalled();
    expect(aggregateReadingSessionSegment).not.toHaveBeenCalled();
    expect(session.durationSeconds).toBe(300);
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

function createLockedSessionRecord(
  input?: Partial<{
    durationSeconds: number;
    endedAt: Date | null;
    id: string;
    lastTrackedAt: Date | null;
    libraryItemId: string;
    startedAt: Date;
    trackedDay: Date;
    userId: string;
  }>,
) {
  return {
    durationSeconds: input?.durationSeconds ?? 0,
    endedAt: input?.endedAt ?? null,
    id: input?.id ?? 'session-1',
    lastTrackedAt: input?.lastTrackedAt ?? new Date('2026-04-12T10:00:00.000Z'),
    libraryItemId: input?.libraryItemId ?? 'library-1',
    startedAt: input?.startedAt ?? new Date('2026-04-12T10:00:00.000Z'),
    trackedDay: input?.trackedDay ?? new Date('2026-04-12T00:00:00.000Z'),
    userId: input?.userId ?? 'user-1',
  };
}

function createReaderPackage(input?: {
  tocMode?: 'flat' | 'nested';
  version?: 1 | 2;
}) {
  const tocMode = input?.tocMode ?? 'flat';
  const version = input?.version ?? 1;
  return {
    version,
    manifest: {
      authors: ['Example Author'],
      language: 'en',
      sourceChecksum: 'checksum',
      title: 'Example Title',
      totalBlocks: tocMode === 'nested' && version === 2 ? 5 : 4,
      totalChapters: 4,
    },
    toc:
      tocMode === 'nested' && version === 2
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
