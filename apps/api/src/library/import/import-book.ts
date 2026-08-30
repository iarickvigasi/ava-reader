import { LibrarySource } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../../users/users.service';
import {
  detectBookFileFormat,
  extractBookMetadata,
  isSupportedSourceFormat,
} from '../../shared/metadata-extractor';
import { addBookToUserLibraryTx } from '../membership/add-book-to-user-library';
import { createBookTx } from './create-book';
import { deleteBookBlobsBestEffort, storeBookBlobs } from './store-book-blobs';

// POST /library/import (docs/specs/7-library/7.4-import.md): validate the
// upload, extract metadata, store blobs, then create the book and shelf it.
export async function importBook(options: {
  clerkUserId: string;
  file: Express.Multer.File;
  prisma: PrismaService;
  usersService: UsersService;
}) {
  if (!options.file) {
    throw new BadRequestException('A book file is required.');
  }

  const format = detectBookFileFormat(options.file);

  if (!isSupportedSourceFormat(format)) {
    throw new BadRequestException('Only EPUB and PDF files are supported.');
  }

  const user = await options.usersService.getCurrentUserRecord(
    options.clerkUserId,
  );
  const metadata = await extractBookMetadata(options.file);

  // Write the blob bytes outside the metadata transaction. Multi-MB writes
  // can blow past the default interactive-transaction timeout and would also
  // hold a DB connection plus row locks for the whole upload. Blobs are
  // referenced by id, so as long as they exist when the metadata insert runs,
  // relational integrity holds.
  const { blob, coverBlob } = await storeBookBlobs({
    coverImage: metadata.coverImage,
    file: options.file,
    format,
    prisma: options.prisma,
  });

  try {
    return await options.prisma.$transaction(async (tx) => {
      const book = await createBookTx(tx, {
        blobId: blob.id,
        coverBlobId: coverBlob?.id,
        format,
        metadata,
      });

      return addBookToUserLibraryTx(tx, {
        bookId: book.id,
        source: LibrarySource.IMPORTED,
        userId: user.id,
      });
    });
  } catch (error) {
    await deleteBookBlobsBestEffort(options.prisma, [
      blob.id,
      ...(coverBlob ? [coverBlob.id] : []),
    ]);
    throw error;
  }
}
