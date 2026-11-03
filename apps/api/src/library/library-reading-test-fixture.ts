export function libraryReadingTestFixture() {
  return {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ readingRevision: 3 }),
    },
    readingSession: { findMany: jest.fn().mockResolvedValue([]) },
    readingSessionSegment: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { durationSeconds: 11700 } }),
    },
  };
}
