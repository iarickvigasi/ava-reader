import { privateBookAccess } from '../shared/private-book-access';
import { LibraryService } from './library.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

it('scopes all cover reads to the authenticated owner, regardless of publication', async () => {
  const findFirst = jest.fn().mockResolvedValue(null);
  const prisma = { book: { findFirst } } as unknown as PrismaService;
  const service = new LibraryService(prisma, {
    getCurrentUserRecord: jest.fn().mockResolvedValue({ id: 'resolved-user' }),
  } as unknown as UsersService);
  expect(
    await service.getBookCover('private-book', 'other-clerk-id'),
  ).toBeNull();
  expect(findFirst).toHaveBeenCalledWith({
    where: {
      id: 'private-book',
      AND: privateBookAccess('resolved-user'),
      libraryItems: { some: { user: { clerkUserId: 'other-clerk-id' } } },
    },
    select: { coverBlob: { select: { bytes: true, mimeType: true } } },
  });
});

it('returns artwork from an owned book', async () => {
  const coverBlob = { bytes: Buffer.from('cover'), mimeType: 'image/png' };
  const prisma = {
    book: { findFirst: jest.fn().mockResolvedValue({ coverBlob }) },
  } as unknown as PrismaService;
  const service = new LibraryService(prisma, {
    getCurrentUserRecord: jest.fn().mockResolvedValue({ id: 'resolved-user' }),
  } as unknown as UsersService);
  expect(await service.getBookCover('owned-book', 'owner')).toBe(coverBlob);
});
