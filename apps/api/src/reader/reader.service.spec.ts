import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import { ReaderService } from './reader.service';

function getFirstCallArg<T>(fn: { mock: { calls: unknown[] } }): T {
  return (fn.mock.calls as Array<[T]>)[0][0];
}

describe('ReaderService', () => {
  const getCurrentUserRecord = jest.fn();
  const findFirstLibraryItem = jest.fn();
  const updateLibraryItem = jest.fn();
  const updateReadingProgress = jest.fn();
  const updateManyReadingProgress = jest.fn();
  const createReadingSession = jest.fn();
  const updateReadingSession = jest.fn();
  const updateManyReadingSessionParticipant = jest.fn();
  const countReadingSessionParticipant = jest.fn();
  const upsertReadingSessionParticipant = jest.fn();
  const upsertReadingSessionSegment = jest.fn();
  const aggregateReadingSessionSegment = jest.fn();
  const queryRaw = jest.fn();

  const tx = {
    $queryRaw: queryRaw,
    readingProgress: {
      updateMany: updateManyReadingProgress,
    },
    readingSession: {
      create: createReadingSession,
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
    libraryItem: {
      findFirst: findFirstLibraryItem,
      update: updateLibraryItem,
    },
    readingProgress: {
      update: updateReadingProgress,
    },
  };

  const usersService = {
    getCurrentUserRecord,
  };
  let readerService: ReaderService;

  beforeEach(() => {
    getCurrentUserRecord.mockReset();
    findFirstLibraryItem.mockReset();
    updateLibraryItem.mockReset();
    updateReadingProgress.mockReset();
    updateManyReadingProgress.mockReset();
    createReadingSession.mockReset();
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

function createLibraryItemRecord(input?: {
  tocMode?: 'flat' | 'nested';
  version?: 1 | 2;
}) {
  const tocMode = input?.tocMode ?? 'flat';
  const version = input?.version ?? 1;
  const readerPackage = {
    version,
    manifest: {
      author: 'Example Author',
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
