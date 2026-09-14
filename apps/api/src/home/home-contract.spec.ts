import { BookFileFormat, BookFileKind } from '@prisma/client';
import { createHomeContractFixture } from './home-contract-fixture';

describe('Home response contract', () => {
  it('returns the complete empty dashboard with default values', async () => {
    const { service, usersService, user } = createHomeContractFixture();
    const home = await service.getHome('clerk_1');
    const { primaryEmail, ...profile } = user;

    expect(usersService.getCurrentUserRecord).toHaveBeenCalledWith('clerk_1');
    expect(home).toEqual({
      collections: { items: [] },
      completionItems: [],
      currentEngagement: null,
      feedback: { acceptsScreenshot: true },
      featuredCatalog: { entries: [] },
      listening: null,
      mastery: {
        dailyGoalMinutes: 60,
        days: expect.any(Array) as unknown,
        remainingMinutes: 60,
        todayMinutes: 0,
      },
      recentAnnotations: { items: [] },
      state: 'EMPTY',
      stats: { aiComments: 0, highlights: 0, hoursReading: 0, volumesRead: 0 },
      user: { ...profile, email: primaryEmail },
    });
  });

  it('provides reading and listening defaults for a newly added book', async () => {
    const { service, prisma, libraryItem } = createHomeContractFixture();
    prisma.libraryItem.findMany.mockResolvedValue([libraryItem]);
    const home = await service.getHome('clerk_1');

    expect(home.state).toBe('POPULATED');
    expect(home.currentEngagement).toEqual({
      authors: [],
      chapterLabel: 'Opening chapters',
      completionPercent: 0,
      finishedAt: null,
      coverImageUrl: null,
      lastReadAt: '2026-08-01T00:00:00.000Z',
      libraryItemId: 'library-1',
      nextMilestone: 'Continue where you left off',
      primaryFormat: 'UNKNOWN',
      slug: 'example-title',
      title: 'Example Title',
    });
    expect(home.listening).toEqual({
      authorLine: 'Unknown author',
      progressPercent: 0,
      title: 'Example Title',
    });
  });

  it('keeps the first book when current engagement dates tie', async () => {
    const { service, prisma, libraryItem } = createHomeContractFixture();
    prisma.libraryItem.findMany.mockResolvedValue([
      { ...libraryItem, id: 'book-z' },
      { ...libraryItem, id: 'book-a' },
    ]);
    const home = await service.getHome('clerk_1');

    expect(home.currentEngagement?.libraryItemId).toBe('book-z');
  });

  it('prefers the source format and serves covers through the library URL', async () => {
    const { service, prisma, libraryItem } = createHomeContractFixture();
    libraryItem.book.authors = ['First Author', 'Second Author'];
    libraryItem.book.coverBlob = { mimeType: 'image/jpeg' };
    libraryItem.book.files = [
      {
        format: BookFileFormat.EPUB,
        isPrimary: true,
        kind: BookFileKind.DERIVED_READER,
      },
      {
        format: BookFileFormat.PDF,
        isPrimary: true,
        kind: BookFileKind.SOURCE,
      },
    ];
    prisma.libraryItem.findMany.mockResolvedValue([libraryItem]);
    const home = await service.getHome('clerk_1');

    expect(home.currentEngagement).toMatchObject({
      coverImageUrl: '/api/library/covers/book-1',
      primaryFormat: 'PDF',
    });
    expect(home.listening?.authorLine).toBe('First Author, Second Author');
  });
});
