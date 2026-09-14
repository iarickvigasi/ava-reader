import { createHomeContractFixture } from './home-contract-fixture';

describe('Home data loading', () => {
  it('starts all eight initial reads before waiting for any result', async () => {
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
    ];
    const release: Array<() => void> = [];
    for (const [query, result] of reads) {
      query.mockImplementation(
        () => new Promise((resolve) => release.push(() => resolve(result))),
      );
    }

    const home = service.getHome('clerk_1');
    await Promise.resolve();

    expect(release).toHaveLength(8);
    for (const resolve of release) resolve();
    await expect(home).resolves.toMatchObject({ state: 'EMPTY' });
  });
});
