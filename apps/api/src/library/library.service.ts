import { createCollection } from './collections/create-collection';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { deleteCollection } from './collections/delete-collection';
import { getCollection } from './collections/get-collection';
import { renameCollection } from './collections/rename-collection';
import { importBook } from './import/import-book';
import { getLibraryItem } from './items/get-library-item';
import { setOfflineRequested } from './items/set-offline-requested';
import { addCatalogBook } from './membership/add-catalog-book';
import { getLibraryOverview } from './overview/get-library-overview';

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  importBook(clerkUserId: string, file: Express.Multer.File) {
    return importBook({
      clerkUserId,
      file,
      prisma: this.prisma,
      usersService: this.usersService,
    });
  }

  async addCatalogBookToLibrary(clerkUserId: string, entryId: string) {
    const user = await this.user(clerkUserId);
    return addCatalogBook({
      entryId,
      prisma: this.prisma,
      userId: user.id,
    });
  }

  async getLibrary(clerkUserId: string) {
    const user = await this.user(clerkUserId);
    return getLibraryOverview({ prisma: this.prisma, userId: user.id });
  }

  async getBookCover(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { coverBlob: { select: { bytes: true, mimeType: true } } },
    });
    return book?.coverBlob ?? null;
  }

  async getCollection(clerkUserId: string, collectionId: string) {
    const user = await this.user(clerkUserId);
    return getCollection({
      prisma: this.prisma,
      ref: collectionId,
      userId: user.id,
    });
  }

  async getLibraryItem(clerkUserId: string, libraryItemId: string) {
    const user = await this.user(clerkUserId);
    return getLibraryItem({
      prisma: this.prisma,
      ref: libraryItemId,
      userId: user.id,
    });
  }

  async setOfflineRequested(
    clerkUserId: string,
    libraryItemId: string,
    requested: boolean,
  ) {
    const user = await this.user(clerkUserId);
    return setOfflineRequested({
      libraryItemId,
      prisma: this.prisma,
      requested,
      userId: user.id,
    });
  }

  async createCollection(
    clerkUserId: string,
    input: { name?: unknown; description?: unknown },
  ) {
    const user = await this.user(clerkUserId);
    return createCollection({ prisma: this.prisma, userId: user.id, input });
  }

  async renameCollection(
    clerkUserId: string,
    collectionId: string,
    input: {
      description?: null | string;
      name?: string;
    },
  ) {
    const user = await this.user(clerkUserId);
    return renameCollection({
      collectionId,
      input,
      prisma: this.prisma,
      userId: user.id,
    });
  }

  async deleteCollection(clerkUserId: string, collectionId: string) {
    const user = await this.user(clerkUserId);
    return deleteCollection({
      collectionId,
      prisma: this.prisma,
      userId: user.id,
    });
  }

  private user(clerkUserId: string) {
    return this.usersService.getCurrentUserRecord(clerkUserId);
  }
}
