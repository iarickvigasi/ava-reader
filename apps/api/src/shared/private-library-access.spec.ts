import { privateBookAccess } from './private-book-access';
import { NotFoundException } from '@nestjs/common';
import { requireOwnedLibraryItem } from './owned-library-item';
import { getOwnedLibraryItem } from '../reader/library-item-access';
import { getLibraryItem } from '../library/items/get-library-item';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

const findFirst = jest.fn().mockResolvedValue(null);
const prisma = { libraryItem: { findFirst } } as unknown as PrismaService;
const users = {
  getCurrentUserRecord: jest.fn().mockResolvedValue({ id: 'other-user' }),
} as unknown as UsersService;
beforeEach(() => jest.clearAllMocks());

it('blocks foreign metadata by item ID and slug', async () => {
  for (const ref of ['private-id', 'private-book-slug']) {
    await expect(
      getLibraryItem({ prisma, ref, userId: 'other-user' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          userId: 'other-user',
          book: privateBookAccess('other-user'),
          isArchived: false,
          OR: [{ id: ref }, { slug: ref }],
        },
      }),
    );
  }
});

it('blocks foreign reader packages and translations before loading file blobs', async () => {
  await expect(
    getOwnedLibraryItem(prisma, users, 'other-clerk', 'private-id'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        userId: 'other-user',
        book: privateBookAccess('other-user'),
        OR: [{ id: 'private-id' }, { slug: 'private-id' }],
      },
    }),
  );
});

it('blocks foreign annotations and AI comments before their data queries', async () => {
  await expect(
    requireOwnedLibraryItem({
      prisma,
      users,
      clerkUserId: 'other-clerk',
      libraryItemId: 'private-id',
    }),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(findFirst).toHaveBeenCalledWith({
    where: {
      id: 'private-id',
      userId: 'other-user',
      book: privateBookAccess('other-user'),
    },
    select: { id: true },
  });
});
