import type { ReadingSession } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { saveReadingCheckpoint } from './save-checkpoint';
import { makeCheckpoint } from './checkpoint-request-fixture';
export { makeCheckpoint } from './checkpoint-request-fixture';

type SessionCreate = {
  data: Partial<ReadingSession> & { clientSessionId: string };
};
type SessionUpdate = { where: { id: string }; data: Partial<ReadingSession> };
type SessionKey = {
  where: { userId_clientSessionId: { clientSessionId: string } };
};
type SegmentCreate = {
  create: {
    readingSessionId: string;
    trackedDay: Date;
    durationSeconds: number;
  };
};

export function checkpointFixture() {
  const sessions = new Map<string, ReadingSession>();
  const segments = new Map<string, number>();
  const tx = {
    $executeRaw: jest.fn(),
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'book' }) },
    deletedLibraryItem: { findFirst: jest.fn().mockResolvedValue(null) },
    readingSession: {
      findUnique: jest.fn(({ where }: SessionKey) =>
        sessions.get(where.userId_clientSessionId.clientSessionId),
      ),
      create: jest.fn(({ data }: SessionCreate) => {
        const row = {
          durationSeconds: 0,
          checkpointRevision: 0,
          endedAt: null,
          lastTrackedAt: null,
          ...data,
          id: data.clientSessionId,
        } as ReadingSession;
        sessions.set(row.id, row);
        return row;
      }),
      update: jest.fn(({ where, data }: SessionUpdate) => {
        const row = { ...sessions.get(where.id), ...data } as ReadingSession;
        sessions.set(row.id, row);
        return row;
      }),
    },
    readingSessionInterval: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    readingSessionSegment: {
      upsert: jest.fn(({ create }: SegmentCreate) => {
        const key =
          create.readingSessionId + ':' + create.trackedDay.toISOString();
        segments.set(key, (segments.get(key) ?? 0) + create.durationSeconds);
      }),
      aggregate: jest.fn(() => ({
        _sum: {
          durationSeconds: [...segments.values()].reduce((a, b) => a + b, 0),
        },
      })),
    },
    readingProgress: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: (run: (value: typeof tx) => unknown) =>
      Promise.resolve(run(tx)),
  } as unknown as PrismaService;
  const save = (
    minutes: number,
    revision: number,
    closed = false,
    id = 'client',
  ) =>
    saveReadingCheckpoint(
      prisma,
      'user',
      'book',
      makeCheckpoint(minutes, revision, closed, id),
    );
  return { tx, prisma, sessions, segments, save };
}
