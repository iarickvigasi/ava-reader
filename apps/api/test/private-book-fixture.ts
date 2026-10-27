import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export async function privateBookFixture(tx: Prisma.TransactionClient) {
  const key = randomUUID();
  const owner = await tx.user.create({
    data: {
      clerkUserId: `privacy-owner-${key}`,
      primaryEmail: 'owner@example.invalid',
    },
  });
  const other = await tx.user.create({
    data: {
      clerkUserId: `privacy-other-${key}`,
      primaryEmail: 'other@example.invalid',
    },
  });
  const cover = await tx.storedBlob.create({
    data: {
      purpose: 'BOOK_COVER',
      originalFilename: 'privacy-fixture.jpg',
      checksum: 'privacy-fixture',
      bytes: Buffer.from('private artwork'),
      mimeType: 'image/jpeg',
      sizeBytes: 15,
    },
  });
  const book = await tx.book.create({
    data: {
      title: 'Private fixture',
      privateOwnerId: owner.id,
      coverBlobId: cover.id,
    },
  });
  const owned = await tx.libraryItem.create({
    data: {
      userId: owner.id,
      bookId: book.id,
      slug: `owner-${key}`,
      source: 'IMPORTED',
    },
  });
  const foreign = await tx.libraryItem.create({
    data: {
      userId: other.id,
      bookId: book.id,
      slug: `other-${key}`,
      source: 'IMPORTED',
    },
  });
  // A corrupt publication pointer must not make a private file available.
  const entry = await tx.catalogEntry.create({
    data: { bookId: book.id, status: 'PUBLISHED' },
  });
  const collection = await tx.collection.create({
    data: {
      userId: other.id,
      name: 'Fixture',
      slug: `fixture-${key}`,
      kind: 'CUSTOM',
      items: { create: { libraryItemId: foreign.id } },
    },
  });
  return { owner, other, book, owned, foreign, entry, collection };
}
