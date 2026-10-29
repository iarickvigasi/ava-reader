import { ReadingDetailsController } from './reading-details.controller';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
it.each([false, true])(
  'returns only public totals with admin=%s, never personal statistics',
  async (admin) => {
    const findFirst = jest.fn();
    findFirst.mockResolvedValue({
      book: {
        estimatedPageCount: 565,
        estimatedBodyPageCount: 540,
        description: 'EPUB description',
      },
    });
    const users = {
      getCurrentUserRecord: jest
        .fn()
        .mockResolvedValue({ roles: admin ? ['ADMIN'] : [] }),
    } as unknown as UsersService;
    const prisma = { catalogEntry: { findFirst } } as unknown as PrismaService;
    const req = { auth: { clerkUserId: 'reader' } } as AuthenticatedRequest;
    await expect(
      new ReadingDetailsController(prisma, users).get(req, 'edition'),
    ).resolves.toEqual({
      approximatePageCount: 565,
      approximateBodyPageCount: 540,
      description: 'EPUB description',
    });
    const [query] = findFirst.mock.calls[0] as [
      {
        where: { book: object; status: unknown; importEvidence: object };
        select: object;
      },
    ];
    expect(query.where.book).toMatchObject({
      visibility: 'PUBLIC',
      privateOwnerId: null,
    });
    expect(query.where.status).toEqual(
      admin ? { in: ['DRAFT', 'PUBLISHED'] } : 'PUBLISHED',
    );
    expect(query.where.importEvidence).toEqual({
      path: ['editionId'],
      equals: 'edition',
    });
    expect(query.select).toEqual({
      book: {
        select: {
          estimatedPageCount: true,
          estimatedBodyPageCount: true,
          description: true,
        },
      },
    });
  },
);
it('returns unknown totals when no authorized public copy exists', async () => {
  const prisma = {
    catalogEntry: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService;
  const users = {
    getCurrentUserRecord: jest.fn().mockResolvedValue({ roles: [] }),
  } as unknown as UsersService;
  const req = { auth: { clerkUserId: 'reader' } } as AuthenticatedRequest;
  await expect(
    new ReadingDetailsController(prisma, users).get(req, 'edition'),
  ).resolves.toEqual({
    approximatePageCount: null,
    approximateBodyPageCount: null,
    description: null,
  });
});
