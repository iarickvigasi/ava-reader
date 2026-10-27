import { readCurrentReadingBook } from '../src/users/discovery/read-current-reading-book';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';
import { LibraryService } from '../src/library/library.service';
import { getLibraryItem } from '../src/library/items/get-library-item';
import { getOwnedLibraryItem } from '../src/reader/library-item-access';
import { requireOwnedLibraryItem } from '../src/shared/owned-library-item';
import { getLibraryOverview } from '../src/library/overview/get-library-overview';
import { getCollection } from '../src/library/collections/get-collection';
import { PUBLIC_CATALOG_BOOK } from '../src/shared/private-book-access';
import { privateBookFixture } from './private-book-fixture';

const prisma = new PrismaService();
const rollback = new Error('roll back privacy fixtures');
afterAll(async () => prisma.$disconnect());

it('isolates a private Book even when another user has a LibraryItem and it has a publication pointer', async () => {
  await expect(
    prisma.$transaction(
      async (tx) => {
        const f = await privateBookFixture(tx);
        expect(f.book.visibility).toBe('PRIVATE');
        const db = tx as unknown as PrismaService;
        await tx.readingProgress.createMany({
          data: [
            {
              libraryItemId: f.owned.id,
              userId: f.owner.id,
              lastReadAt: new Date(),
              completionPercent: 5,
            },
            {
              libraryItemId: f.foreign.id,
              userId: f.other.id,
              lastReadAt: new Date(),
              completionPercent: 5,
            },
          ],
        });
        expect(await readCurrentReadingBook(db, f.owner.id)).toMatchObject({
          title: f.book.title,
        });
        expect(await readCurrentReadingBook(db, f.other.id)).toBeNull();

        const users = {
          getCurrentUserRecord: (id: string) =>
            Promise.resolve(id === f.owner.clerkUserId ? f.owner : f.other),
        } as unknown as UsersService;
        const service = new LibraryService(db, users);
        expect(
          await service.getBookCover(f.book.id, f.owner.clerkUserId),
        ).not.toBeNull();
        expect(
          await service.getBookCover(f.book.id, f.other.clerkUserId),
        ).toBeNull();
        const args = { prisma: db, userId: f.other.id, ref: f.foreign.id };
        await expect(getLibraryItem(args)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        await expect(
          getOwnedLibraryItem(db, users, f.other.clerkUserId, f.foreign.id),
        ).rejects.toBeInstanceOf(NotFoundException);
        await expect(
          requireOwnedLibraryItem({
            prisma: db,
            users,
            clerkUserId: f.other.clerkUserId,
            libraryItemId: f.foreign.id,
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(
          (await getLibraryOverview({ prisma: tx, userId: f.other.id })).books,
        ).toEqual([]);
        expect(
          (await getCollection({ ...args, ref: f.collection.id })).collection
            .books,
        ).toEqual([]);
        expect(
          await tx.catalogEntry.findFirst({
            where: { id: f.entry.id, book: PUBLIC_CATALOG_BOOK },
          }),
        ).toBeNull();
        await tx.book.update({
          where: { id: f.book.id },
          data: { privateOwnerId: null },
        });
        expect(
          await service.getBookCover(f.book.id, f.owner.clerkUserId),
        ).toBeNull();
        throw rollback;
      },
      { timeout: 15_000 },
    ),
  ).rejects.toBe(rollback);
}, 20_000);
