import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SMART_COLLECTIONS,
  OFFLINE_BOOKS_SMART_KEY,
} from '../shared/default-collections';
import { ensureOfflineBooksCollection } from './ensure-offline-books-collection';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ava_reader?schema=public',
});
const prisma = new PrismaClient({ adapter });

// Default collections are only ensured when a book is imported, so every user
// who already had a library when the Offline Books shelf shipped is invisible
// to that path. Creates the collection for them and seeds its membership from
// LibraryItem.offlineRequested. Safe to re-run — existing rows are left alone.
// See docs/specs/17-offline-books-collection.md.
async function main() {
  const definition = DEFAULT_SMART_COLLECTIONS.find(
    (entry) => entry.smartKey === OFFLINE_BOOKS_SMART_KEY,
  );

  if (!definition) {
    throw new Error(`No ${OFFLINE_BOOKS_SMART_KEY} entry to backfill.`);
  }

  const users = await prisma.user.findMany({
    where: { libraryItems: { some: {} } },
    select: { id: true },
  });

  let created = 0;
  let linked = 0;

  for (const user of users) {
    const collection = await ensureOfflineBooksCollection(
      prisma,
      user.id,
      definition,
    );
    const requested = await prisma.libraryItem.findMany({
      where: { userId: user.id, isArchived: false, offlineRequested: true },
      select: { id: true },
    });
    const links = await prisma.collectionItem.createMany({
      data: requested.map((item) => ({
        collectionId: collection.id,
        libraryItemId: item.id,
      })),
      skipDuplicates: true,
    });

    created += collection.created ? 1 : 0;
    linked += links.count;
  }

  console.log(
    `Checked ${users.length} user(s); created ${created} collection(s), ` +
      `linked ${linked} offline-requested book(s).`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
