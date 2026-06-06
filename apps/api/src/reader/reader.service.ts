import {
  BookFileFormat,
  BookFileKind,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type {
  ReaderChapter,
  ReaderLocator,
  ReaderPackage,
  ReadingProgressIndex,
  ReaderTocNode,
} from './reader-types';

type ReaderProgressSummary = {
  chapterLabel: string | null;
  completionPercent: number;
  lastReadAt: string | null;
  locator: ReaderLocator | null;
};

type ReaderBookPayload = {
  authors: string[];
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

type ReaderReadyPayload = {
  activeChapterId: string;
  book: ReaderBookPayload;
  chapters: ReaderChapter[];
  progress: ReaderProgressSummary;
  status: 'READY';
  toc: ReaderTocNode[];
};

type ReaderStatusPayload =
  | ReaderReadyPayload
  | {
      book: ReaderBookPayload;
      message: string;
      progress: ReaderProgressSummary;
      status: 'FAILED' | 'PROCESSING' | 'UNSUPPORTED';
    };

type ReaderSessionPayload = {
  durationSeconds: number;
  endedAt: string | null;
  lastTrackedAt: string | null;
  sessionId: string;
  startedAt: string;
};

const SESSION_PARTICIPANT_IDLE_TIMEOUT_MS = 90_000;
const SESSION_SECONDS_PER_DAY = 86_400;

// In-process LRU cache for parsed reader packages. Each package can be tens of
// MB once parsed into JS objects; without caching, every chapter navigation
// re-loads the blob from Postgres and reparses the JSON, which spikes memory
// and risks OOM-killing the API process for large books. Keyed by `blobId`,
// which is immutable — a new StoredBlob row is created when the package is
// regenerated (see ReaderProcessingService).
const READER_PACKAGE_CACHE_MAX_ENTRIES = 4;
const readerPackageCache = new Map<string, ReaderPackage>();
// Coalesces concurrent loads for the same blobId so a burst of chapter
// navigations doesn't trigger N parallel multi-MB JSON parses.
const readerPackageLoadsInFlight = new Map<string, Promise<ReaderPackage>>();

function rememberReaderPackage(
  blobId: string,
  readerPackage: ReaderPackage,
): ReaderPackage {
  // Refresh recency by deleting + reinserting (Map preserves insertion order).
  readerPackageCache.delete(blobId);
  readerPackageCache.set(blobId, readerPackage);
  while (readerPackageCache.size > READER_PACKAGE_CACHE_MAX_ENTRIES) {
    // `Map.keys().next()` types `.value` as `TReturn = any` on the done
    // branch, which trips no-unsafe-assignment. Narrow via `done` instead.
    const oldest = readerPackageCache.keys().next();
    if (oldest.done) {
      break;
    }
    readerPackageCache.delete(oldest.value);
  }
  return readerPackage;
}

function getCachedReaderPackage(blobId: string): ReaderPackage | null {
  const cached = readerPackageCache.get(blobId);
  if (!cached) {
    return null;
  }
  // Touch for LRU recency.
  readerPackageCache.delete(blobId);
  readerPackageCache.set(blobId, cached);
  return cached;
}

// Test hook — resets the in-process cache so unit tests do not leak parsed
// packages between cases.
export function __resetReaderPackageCacheForTesting() {
  readerPackageCache.clear();
  readerPackageLoadsInFlight.clear();
}

const lockedSessionSelect = {
  durationSeconds: true,
  endedAt: true,
  id: true,
  lastTrackedAt: true,
  libraryItemId: true,
  startedAt: true,
  trackedDay: true,
  userId: true,
} satisfies Prisma.ReadingSessionSelect;

type LockedSessionRecord = Prisma.ReadingSessionGetPayload<{
  select: typeof lockedSessionSelect;
}>;

@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getReaderPayload(
    clerkUserId: string,
    libraryItemId: string,
    chapterId?: string,
  ): Promise<ReaderStatusPayload> {
    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );

    const sourceFile = libraryItem.book.files.find(
      (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
    );
    const progress = createProgressSummary(libraryItem.progress);

    if (!sourceFile || sourceFile.format !== BookFileFormat.EPUB) {
      return {
        book: {
          authors: libraryItem.book.authors,
          libraryItemId: libraryItem.id,
          primaryFormat: sourceFile?.format ?? BookFileFormat.UNKNOWN,
          slug: libraryItem.slug,
          title: libraryItem.book.title,
        },
        message: 'This reader currently supports EPUB books only.',
        progress,
        status: 'UNSUPPORTED',
      };
    }

    const derivedReader = libraryItem.book.files.find(
      (file) =>
        file.kind === BookFileKind.DERIVED_READER &&
        file.isPrimary &&
        file.processingStatus === ProcessingStatus.READY,
    );

    if (!derivedReader) {
      const latestRun = libraryItem.book.processingRuns[0] ?? null;

      if (latestRun?.status === ProcessingStatus.FAILED) {
        return {
          book: {
            authors: libraryItem.book.authors,
            libraryItemId: libraryItem.id,
            primaryFormat: sourceFile.format,
            slug: libraryItem.slug,
            title: libraryItem.book.title,
          },
          message:
            latestRun.errorMessage ??
            'The EPUB could not be prepared for the reader.',
          progress,
          status: 'FAILED',
        };
      }

      return {
        book: {
          authors: libraryItem.book.authors,
          libraryItemId: libraryItem.id,
          primaryFormat: sourceFile.format,
          slug: libraryItem.slug,
          title: libraryItem.book.title,
        },
        message: 'Preparing this EPUB for the reader.',
        progress,
        status: 'PROCESSING',
      };
    }

    const readerPackage = await this.loadReaderPackage(derivedReader.blobId);
    const selectedChapter =
      selectChapter(readerPackage, chapterId) ??
      selectChapter(readerPackage, progress.locator?.chapterId) ??
      readerPackage.chapters[0];

    if (!selectedChapter) {
      throw new BadRequestException(
        'The derived reader package has no chapters.',
      );
    }

    const chapterWindow = selectChapterWindow(
      readerPackage,
      selectedChapter.chapterId,
    );

    return {
      activeChapterId: selectedChapter.chapterId,
      book: {
        authors: libraryItem.book.authors,
        libraryItemId: libraryItem.id,
        primaryFormat: sourceFile.format,
        slug: libraryItem.slug,
        title: libraryItem.book.title,
      },
      chapters: chapterWindow,
      progress,
      status: 'READY',
      toc: readerPackage.toc,
    };
  }

  async updateProgress(
    clerkUserId: string,
    libraryItemId: string,
    locator: ReaderLocator,
  ): Promise<ReaderProgressSummary> {
    validateLocator(locator);

    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );
    const derivedReader = libraryItem.book.files.find(
      (file) =>
        file.kind === BookFileKind.DERIVED_READER &&
        file.isPrimary &&
        file.processingStatus === ProcessingStatus.READY,
    );

    if (!derivedReader) {
      throw new BadRequestException('The reader package is not ready yet.');
    }

    const index = await this.loadReadingProgressIndex(derivedReader);
    const metrics = computeProgressMetricsFromIndex(index, locator);

    const progress = await this.prisma.readingProgress.update({
      where: {
        libraryItemId,
      },
      data: {
        chapterLabel: metrics.chapterLabel,
        completionPercent: metrics.completionPercent,
        currentLocator: JSON.stringify(locator),
        lastReadAt: new Date(),
      },
    });

    await this.prisma.libraryItem.update({
      where: {
        id: libraryItemId,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });

    return createProgressSummary(progress);
  }

  async markReaderOpened(clerkUserId: string, libraryItemId: string) {
    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );

    await this.prisma.libraryItem.update({
      where: {
        id: libraryItem.id,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });
  }

  async startSession(
    clerkUserId: string,
    libraryItemId: string,
    clientInstanceId: string,
    // Phase 4: offline replay support. When clientSessionId is supplied,
    // the call upserts by (userId, clientSessionId) — the second invocation
    // with the same id returns the existing row instead of creating a new
    // one. startedAt/endedAt let an offline-completed session replay with
    // its original timestamps so reading-hour totals stay accurate.
    offlineReplay: {
      clientSessionId: string | null;
      startedAt: string | null;
      endedAt: string | null;
    } = { clientSessionId: null, startedAt: null, endedAt: null },
  ) {
    validateClientInstanceId(clientInstanceId);
    const libraryItem = await this.getOwnedLibraryItem(
      clerkUserId,
      libraryItemId,
    );
    const now = new Date();
    const replayStart = offlineReplay.startedAt
      ? new Date(offlineReplay.startedAt)
      : null;
    const replayEnd = offlineReplay.endedAt
      ? new Date(offlineReplay.endedAt)
      : null;
    const sessionStartedAt = replayStart ?? now;
    const session = await this.prisma.$transaction(async (tx) => {
      // Offline replay path: if the client supplied a stable id, look it
      // up first. A second POST with the same id is a no-op-ish: returns
      // the existing row. Distinct from the "active session" lookup below
      // because a replayed session may already be `endedAt` and so isn't
      // "active."
      if (offlineReplay.clientSessionId) {
        const existing = await tx.readingSession.findFirst({
          where: {
            userId: libraryItem.userId,
            clientSessionId: offlineReplay.clientSessionId,
          },
          select: lockedSessionSelect,
        });
        if (existing) {
          return this.applySessionActionTx(
            tx,
            existing,
            now,
            clientInstanceId,
            'start',
          );
        }
      }

      let activeSession = await this.lockActiveSessionTx(
        tx,
        libraryItem.userId,
        libraryItemId,
      );

      if (!activeSession) {
        try {
          activeSession = await tx.readingSession.create({
            data: {
              durationMinutes: 0,
              durationSeconds: 0,
              lastTrackedAt: replayEnd ?? sessionStartedAt,
              endedAt: replayEnd,
              libraryItemId,
              startedAt: sessionStartedAt,
              trackedDay: startOfUtcDay(sessionStartedAt),
              userId: libraryItem.userId,
              clientSessionId: offlineReplay.clientSessionId,
            },
            select: lockedSessionSelect,
          });
        } catch (error) {
          const recoveredSession = await this.lockActiveSessionTx(
            tx,
            libraryItem.userId,
            libraryItemId,
          );
          if (!recoveredSession) {
            throw error;
          }
          activeSession = recoveredSession;
        }
      }

      if (!activeSession) {
        throw new NotFoundException('The reading session was not found.');
      }

      return this.applySessionActionTx(
        tx,
        activeSession,
        now,
        clientInstanceId,
        'start',
      );
    });

    return serializeSession(session);
  }

  async heartbeatSession(
    clerkUserId: string,
    libraryItemId: string,
    sessionId: string,
    clientInstanceId: string,
  ) {
    validateSessionId(sessionId);
    validateClientInstanceId(clientInstanceId);
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const now = new Date();
    const session = await this.prisma.$transaction(async (tx) => {
      const lockedSession = await this.lockOwnedSessionTx(
        tx,
        user.id,
        libraryItemId,
        sessionId,
      );

      if (!lockedSession) {
        throw new NotFoundException('The reading session was not found.');
      }

      if (lockedSession.endedAt) {
        return lockedSession;
      }

      return this.applySessionActionTx(
        tx,
        lockedSession,
        now,
        clientInstanceId,
        'heartbeat',
      );
    });

    return serializeSession(session);
  }

  async stopSession(
    clerkUserId: string,
    libraryItemId: string,
    sessionId: string,
    clientInstanceId: string,
  ) {
    validateSessionId(sessionId);
    validateClientInstanceId(clientInstanceId);
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const now = new Date();
    const session = await this.prisma.$transaction(async (tx) => {
      const lockedSession = await this.lockOwnedSessionTx(
        tx,
        user.id,
        libraryItemId,
        sessionId,
      );

      if (!lockedSession) {
        throw new NotFoundException('The reading session was not found.');
      }

      if (lockedSession.endedAt) {
        return lockedSession;
      }

      return this.applySessionActionTx(
        tx,
        lockedSession,
        now,
        clientInstanceId,
        'stop',
      );
    });

    return serializeSession(session);
  }

  private async getOwnedLibraryItem(
    clerkUserId: string,
    libraryItemId: string,
  ) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const libraryItem = await this.prisma.libraryItem.findFirst({
      where: {
        userId: user.id,
        OR: [{ id: libraryItemId }, { slug: libraryItemId }],
      },
      include: {
        book: {
          include: {
            files: {
              select: {
                id: true,
                blobId: true,
                createdAt: true,
                format: true,
                isPrimary: true,
                kind: true,
                processingStatus: true,
                readingProgressIndex: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            processingRuns: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
        progress: true,
      },
    });

    if (!libraryItem) {
      throw new NotFoundException('The requested library item was not found.');
    }

    return libraryItem;
  }

  private async loadBlobBytes(blobId: string): Promise<Buffer> {
    const blob = await this.prisma.storedBlob.findUniqueOrThrow({
      where: { id: blobId },
      select: { bytes: true },
    });
    return Buffer.from(blob.bytes);
  }

  // Reads the compact progress index for a derived-reader file. For rows that
  // were created before the `readingProgressIndex` column existed (or whose stored JSON
  // doesn't validate), falls back to parsing the full package once and writes
  // the index back so future calls are O(1).
  private async loadReadingProgressIndex(file: {
    blobId: string;
    id: string;
    readingProgressIndex: unknown;
  }): Promise<ReadingProgressIndex> {
    const stored = parseStoredReadingProgressIndex(file.readingProgressIndex);
    if (stored) {
      return stored;
    }
    const readerPackage = await this.loadReaderPackage(file.blobId);
    const index = buildReadingProgressIndex(readerPackage);
    // Fire-and-forget back-fill — failure to persist must not block the
    // progress write the user is currently making.
    this.prisma.bookFile
      .update({
        where: { id: file.id },
        data: {
          readingProgressIndex: index as unknown as Prisma.InputJsonValue,
        },
      })
      .catch(() => {
        // Swallow — next request will retry the back-fill.
      });
    return index;
  }

  private async loadReaderPackage(blobId: string): Promise<ReaderPackage> {
    const cached = getCachedReaderPackage(blobId);
    if (cached) {
      return cached;
    }
    const inFlight = readerPackageLoadsInFlight.get(blobId);
    if (inFlight) {
      return inFlight;
    }
    const loadPromise = (async () => {
      try {
        const bytes = await this.loadBlobBytes(blobId);
        const readerPackage = parseReaderPackage(bytes);
        return rememberReaderPackage(blobId, readerPackage);
      } finally {
        readerPackageLoadsInFlight.delete(blobId);
      }
    })();
    readerPackageLoadsInFlight.set(blobId, loadPromise);
    return loadPromise;
  }

  private async lockActiveSessionTx(
    tx: Prisma.TransactionClient,
    userId: string,
    libraryItemId: string,
  ) {
    const rows = await tx.$queryRaw<LockedSessionRecord[]>(Prisma.sql`
      SELECT
        "id",
        "userId",
        "libraryItemId",
        "trackedDay",
        "durationSeconds",
        "startedAt",
        "lastTrackedAt",
        "endedAt"
      FROM "ReadingSession"
      WHERE "userId" = ${userId}
        AND "libraryItemId" = ${libraryItemId}
        AND "endedAt" IS NULL
      ORDER BY "startedAt" DESC
      LIMIT 1
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async lockOwnedSessionTx(
    tx: Prisma.TransactionClient,
    userId: string,
    libraryItemId: string,
    sessionId: string,
  ) {
    const rows = await tx.$queryRaw<LockedSessionRecord[]>(Prisma.sql`
      SELECT
        "id",
        "userId",
        "libraryItemId",
        "trackedDay",
        "durationSeconds",
        "startedAt",
        "lastTrackedAt",
        "endedAt"
      FROM "ReadingSession"
      WHERE "id" = ${sessionId}
        AND "libraryItemId" = ${libraryItemId}
        AND "userId" = ${userId}
      LIMIT 1
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async applySessionActionTx(
    tx: Prisma.TransactionClient,
    session: LockedSessionRecord,
    now: Date,
    clientInstanceId: string,
    action: 'heartbeat' | 'start' | 'stop',
  ) {
    const activeCutoff = new Date(
      now.getTime() - SESSION_PARTICIPANT_IDLE_TIMEOUT_MS,
    );
    await tx.readingSessionParticipant.updateMany({
      where: {
        readingSessionId: session.id,
        stoppedAt: null,
        lastSeenAt: {
          lt: activeCutoff,
        },
      },
      data: {
        stoppedAt: now,
      },
    });

    const activeParticipantCountBefore =
      await tx.readingSessionParticipant.count({
        where: {
          readingSessionId: session.id,
          stoppedAt: null,
          lastSeenAt: {
            gte: activeCutoff,
          },
        },
      });

    const elapsedSeconds =
      activeParticipantCountBefore > 0
        ? computeElapsedSeconds(session.lastTrackedAt ?? now, now)
        : 0;

    if (elapsedSeconds > 0) {
      await this.incrementSessionSegmentsTx(
        tx,
        session,
        session.lastTrackedAt ?? now,
        elapsedSeconds,
      );
    }

    if (action === 'stop') {
      await tx.readingSessionParticipant.upsert({
        where: {
          readingSessionId_clientInstanceId: {
            readingSessionId: session.id,
            clientInstanceId,
          },
        },
        update: {
          lastSeenAt: now,
          stoppedAt: now,
        },
        create: {
          clientInstanceId,
          lastSeenAt: now,
          libraryItemId: session.libraryItemId,
          readingSessionId: session.id,
          stoppedAt: now,
          userId: session.userId,
        },
      });
    } else {
      await tx.readingSessionParticipant.upsert({
        where: {
          readingSessionId_clientInstanceId: {
            readingSessionId: session.id,
            clientInstanceId,
          },
        },
        update: {
          lastSeenAt: now,
          stoppedAt: null,
        },
        create: {
          clientInstanceId,
          lastSeenAt: now,
          libraryItemId: session.libraryItemId,
          readingSessionId: session.id,
          stoppedAt: null,
          userId: session.userId,
        },
      });
    }

    const activeParticipantCountAfter =
      await tx.readingSessionParticipant.count({
        where: {
          readingSessionId: session.id,
          stoppedAt: null,
          lastSeenAt: {
            gte: activeCutoff,
          },
        },
      });
    const shouldEnd = action === 'stop' && activeParticipantCountAfter === 0;
    const nextDurationSeconds = session.durationSeconds + elapsedSeconds;

    const updatedSession = await tx.readingSession.update({
      where: {
        id: session.id,
      },
      data: {
        durationMinutes: Math.floor(nextDurationSeconds / 60),
        durationSeconds: nextDurationSeconds,
        endedAt: shouldEnd ? now : null,
        lastTrackedAt: now,
        trackedDay: startOfUtcDay(now),
      },
      select: lockedSessionSelect,
    });

    if (elapsedSeconds > 0) {
      await this.syncReadingProgressMinutesTx(
        tx,
        session.userId,
        session.libraryItemId,
      );
    }

    return updatedSession;
  }

  private async incrementSessionSegmentsTx(
    tx: Prisma.TransactionClient,
    session: LockedSessionRecord,
    startTimestamp: Date,
    elapsedSeconds: number,
  ) {
    const segmentDeltas = splitElapsedSecondsByUtcDay(
      startTimestamp,
      elapsedSeconds,
    );

    for (const segment of segmentDeltas) {
      await tx.readingSessionSegment.upsert({
        where: {
          readingSessionId_trackedDay: {
            readingSessionId: session.id,
            trackedDay: segment.trackedDay,
          },
        },
        update: {
          durationSeconds: {
            increment: segment.durationSeconds,
          },
        },
        create: {
          durationSeconds: segment.durationSeconds,
          libraryItemId: session.libraryItemId,
          readingSessionId: session.id,
          trackedDay: segment.trackedDay,
          userId: session.userId,
        },
      });
    }
  }

  private async syncReadingProgressMinutesTx(
    tx: Prisma.TransactionClient,
    userId: string,
    libraryItemId: string,
  ) {
    const totalSeconds = await tx.readingSessionSegment.aggregate({
      where: {
        libraryItemId,
        userId,
      },
      _sum: {
        durationSeconds: true,
      },
    });

    await tx.readingProgress.updateMany({
      where: {
        libraryItemId,
        userId,
      },
      data: {
        minutesRead: Math.floor((totalSeconds._sum.durationSeconds ?? 0) / 60),
      },
    });
  }
}

function parseReaderPackage(buffer: Buffer): ReaderPackage {
  const raw = JSON.parse(buffer.toString('utf8')) as unknown;
  const candidate =
    raw && typeof raw === 'object'
      ? (raw as { chapters?: unknown; version?: unknown })
      : null;

  if (
    !candidate ||
    (candidate.version !== 1 && candidate.version !== 2) ||
    !Array.isArray(candidate.chapters)
  ) {
    throw new BadRequestException('The stored reader package is invalid.');
  }

  if (candidate.version === 1) {
    return normalizeLegacyReaderPackage(raw as LegacyReaderPackage);
  }

  return normalizeReaderPackageManifestAuthors(
    raw as ReaderPackageWithLegacyAuthors,
  );
}

function selectChapter(
  readerPackage: ReaderPackage,
  chapterId?: string | null,
) {
  if (!chapterId) {
    return null;
  }

  return (
    readerPackage.chapters.find((chapter) => chapter.chapterId === chapterId) ??
    null
  );
}

function selectChapterWindow(
  readerPackage: ReaderPackage,
  activeChapterId: string,
) {
  const activeIndex = readerPackage.chapters.findIndex(
    (chapter) => chapter.chapterId === activeChapterId,
  );

  if (activeIndex === -1) {
    return [];
  }

  const windowStart = Math.max(0, activeIndex - 1);
  const windowEnd = Math.min(readerPackage.chapters.length, activeIndex + 2);

  return readerPackage.chapters.slice(windowStart, windowEnd);
}

function createProgressSummary(
  progress: {
    chapterLabel: string | null;
    completionPercent: number;
    currentLocator: string | null;
    lastReadAt: Date | null;
  } | null,
): ReaderProgressSummary {
  return {
    chapterLabel: progress?.chapterLabel ?? null,
    completionPercent: progress?.completionPercent ?? 0,
    lastReadAt: progress?.lastReadAt?.toISOString() ?? null,
    locator: parseLocator(progress?.currentLocator ?? null),
  };
}

function serializeSession(session: {
  durationSeconds: number;
  endedAt: Date | null;
  id: string;
  lastTrackedAt: Date | null;
  startedAt: Date;
}): ReaderSessionPayload {
  return {
    durationSeconds: session.durationSeconds,
    endedAt: session.endedAt?.toISOString() ?? null,
    lastTrackedAt: session.lastTrackedAt?.toISOString() ?? null,
    sessionId: session.id,
    startedAt: session.startedAt.toISOString(),
  };
}

function computeElapsedSeconds(lastTrackedAt: Date, timestamp: Date) {
  return Math.max(
    Math.round((timestamp.getTime() - lastTrackedAt.getTime()) / 1000),
    0,
  );
}

function splitElapsedSecondsByUtcDay(start: Date, elapsedSeconds: number) {
  if (elapsedSeconds <= 0) {
    return [] as Array<{ durationSeconds: number; trackedDay: Date }>;
  }

  const segments: Array<{ durationSeconds: number; trackedDay: Date }> = [];
  let cursorSeconds = Math.floor(start.getTime() / 1000);
  const endSeconds = cursorSeconds + elapsedSeconds;

  while (cursorSeconds < endSeconds) {
    const cursorDate = new Date(cursorSeconds * 1000);
    const trackedDay = startOfUtcDay(cursorDate);
    const nextDayBoundarySeconds =
      Math.floor(trackedDay.getTime() / 1000) + SESSION_SECONDS_PER_DAY;
    const sliceEnd = Math.min(endSeconds, nextDayBoundarySeconds);
    const durationSeconds = Math.max(sliceEnd - cursorSeconds, 0);

    if (durationSeconds > 0) {
      segments.push({
        durationSeconds,
        trackedDay,
      });
    }

    cursorSeconds = sliceEnd;
  }

  return segments;
}

function parseLocator(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ReaderLocator>;

    if (
      typeof parsed.chapterId !== 'string' ||
      typeof parsed.blockId !== 'string' ||
      typeof parsed.textOffset !== 'number'
    ) {
      return null;
    }

    return {
      blockId: parsed.blockId,
      chapterId: parsed.chapterId,
      textOffset: parsed.textOffset,
    };
  } catch {
    return null;
  }
}

function validateLocator(locator: ReaderLocator) {
  if (!locator || Number.isNaN(locator.textOffset) || locator.textOffset < 0) {
    throw new BadRequestException('A valid reader locator is required.');
  }
}

function validateSessionId(sessionId: string) {
  if (!sessionId?.trim()) {
    throw new BadRequestException('A valid reader session id is required.');
  }
}

function validateClientInstanceId(clientInstanceId: string) {
  if (!clientInstanceId?.trim()) {
    throw new BadRequestException(
      'A valid reader client instance id is required.',
    );
  }
}

function computeProgressMetricsFromIndex(
  index: ReadingProgressIndex,
  locator: ReaderLocator,
) {
  const chapterIndex = index.chapters.findIndex(
    (chapter) => chapter.chapterId === locator.chapterId,
  );

  if (chapterIndex === -1) {
    throw new BadRequestException('The requested chapter does not exist.');
  }

  const chapter = index.chapters[chapterIndex];
  const blockIndex = chapter.blockIds.indexOf(locator.blockId);

  if (blockIndex === -1) {
    throw new BadRequestException('The requested block does not exist.');
  }

  const blocksBeforeChapter = index.chapters
    .slice(0, chapterIndex)
    .reduce((sum, currentChapter) => sum + currentChapter.blockIds.length, 0);
  const absoluteBlockIndex = blocksBeforeChapter + blockIndex + 1;
  const completionPercent =
    index.totalBlocks > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((absoluteBlockIndex / index.totalBlocks) * 100),
          ),
        )
      : 0;

  return {
    chapterLabel:
      findBestTocLabel(index.toc, locator) ?? chapter.title ?? chapter.label,
    completionPercent,
  };
}

// Builds the compact progress index from a fully-parsed reader package. Used
// by the processing pipeline (eagerly) and by the reader service (as a lazy
// back-fill for legacy DERIVED_READER rows that predate this column).
export function buildReadingProgressIndex(
  readerPackage: ReaderPackage,
): ReadingProgressIndex {
  return {
    chapters: readerPackage.chapters.map((chapter) => ({
      blockIds: chapter.blocks.map((block) => block.id),
      chapterId: chapter.chapterId,
      label: chapter.label,
      title: chapter.title,
    })),
    toc: readerPackage.toc,
    totalBlocks: readerPackage.manifest.totalBlocks,
    version: 1,
  };
}

// Validates a stored JSON value as a ReadingProgressIndex. Returns null if the
// shape doesn't match (e.g. legacy `null`, or a value written by an older
// schema version).
function parseStoredReadingProgressIndex(
  value: unknown,
): ReadingProgressIndex | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<ReadingProgressIndex>;
  if (
    candidate.version !== 1 ||
    typeof candidate.totalBlocks !== 'number' ||
    !Array.isArray(candidate.chapters) ||
    !Array.isArray(candidate.toc)
  ) {
    return null;
  }
  for (const chapter of candidate.chapters) {
    if (!chapter || !Array.isArray(chapter.blockIds)) {
      return null;
    }
  }
  return candidate as ReadingProgressIndex;
}

type LegacyReaderTocEntry = {
  chapterId: string;
  href: string;
  label: string;
  spineIndex: number;
};

type LegacyReaderPackage = Omit<ReaderPackage, 'toc' | 'version'> & {
  toc: LegacyReaderTocEntry[];
  version: 1;
};

type ReaderPackageWithLegacyAuthors = Omit<ReaderPackage, 'manifest'> & {
  manifest: Omit<ReaderPackage['manifest'], 'authors'> & {
    author?: null | string;
    authors?: string[];
  };
};

function normalizeLegacyReaderPackage(
  readerPackage: LegacyReaderPackage,
): ReaderPackage {
  const normalizedPackage: ReaderPackageWithLegacyAuthors = {
    ...readerPackage,
    toc: readerPackage.toc.map((entry, index) => ({
      anchorId: null,
      blockId: null,
      chapterId: entry.chapterId,
      children: [],
      href: entry.href,
      id: `toc:${index}`,
      label: entry.label,
      spineIndex: entry.spineIndex,
    })),
    version: 2,
  };

  return normalizeReaderPackageManifestAuthors(normalizedPackage);
}

function normalizeReaderPackageManifestAuthors(
  readerPackage: ReaderPackageWithLegacyAuthors,
): ReaderPackage {
  const authorCandidates = Array.isArray(readerPackage.manifest.authors)
    ? readerPackage.manifest.authors
    : typeof readerPackage.manifest.author === 'string'
      ? [readerPackage.manifest.author]
      : [];
  const authors = authorCandidates
    .map((author) => author.trim())
    .filter((author) => author.length > 0);

  return {
    ...readerPackage,
    manifest: {
      ...readerPackage.manifest,
      authors,
    },
  };
}

function findBestTocLabel(
  toc: ReaderTocNode[],
  locator: ReaderLocator,
): string | null {
  const exactMatch = findDeepestTocMatch(
    toc,
    (node) =>
      node.chapterId === locator.chapterId && node.blockId === locator.blockId,
  );

  if (exactMatch?.label) {
    return exactMatch.label;
  }

  return (
    findFirstTocMatch(toc, (node) => node.chapterId === locator.chapterId)
      ?.label ?? null
  );
}

function findDeepestTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
  depth = 0,
): { depth: number; label: string } | null {
  let bestMatch: { depth: number; label: string } | null = null;

  for (const node of toc) {
    if (predicate(node) && node.label) {
      bestMatch = { depth, label: node.label };
    }

    const nestedMatch = findDeepestTocMatch(
      node.children,
      predicate,
      depth + 1,
    );
    if (nestedMatch && (!bestMatch || nestedMatch.depth >= bestMatch.depth)) {
      bestMatch = nestedMatch;
    }
  }

  return bestMatch;
}

function findFirstTocMatch(
  toc: ReaderTocNode[],
  predicate: (node: ReaderTocNode) => boolean,
): ReaderTocNode | null {
  for (const node of toc) {
    if (predicate(node)) {
      return node;
    }

    const nestedMatch = findFirstTocMatch(node.children, predicate);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
