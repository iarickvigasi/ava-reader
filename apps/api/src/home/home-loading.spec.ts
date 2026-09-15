import { createHomeContractFixture } from './home-contract-fixture';

describe('Home data loading', () => {
  it('starts all nine initial reads before waiting for any result', async () => {
    const { service, prisma, findCompletionItems } =
      createHomeContractFixture();
    const reads: Array<[jest.Mock, unknown]> = [
      [prisma.libraryItem.findMany, []],
      [prisma.catalogEntry.findMany, []],
      [prisma.collection.findMany, []],
      [prisma.readingSessionSegment.findMany, []],
      [
        prisma.readingSessionSegment.aggregate,
        { _sum: { durationSeconds: 0 } },
      ],
      [prisma.annotation.count, 0],
      [findCompletionItems, []],
      [prisma.aiComment.count, 0],
      [prisma.userPreferences.findUnique, null],
    ];
    const release: Array<() => void> = [];
    for (const [query, result] of reads) {
      query.mockImplementation(
        () => new Promise((resolve) => release.push(() => resolve(result))),
      );
    }

    const home = service.getHome('clerk_1');
    await Promise.resolve();

    expect(release).toHaveLength(9);
    for (const resolve of release) resolve();
    await expect(home).resolves.toMatchObject({ state: 'EMPTY' });
  });
});
