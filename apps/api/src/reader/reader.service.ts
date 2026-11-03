import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getOwnedLibraryItem } from './library-item-access';
import { validateLocator } from './progress/locator';
import { createProgressSummary } from './progress/progress-summary';
import { updateReadingProgress } from './progress/update-progress';
import { buildReaderPayload } from './payload/reader-payload';
import type {
  ReaderProgressSummary,
  ReaderStatusPayload,
} from './payload/reader-payload-types';
import type { ReaderLocator } from './reader-types';
@Injectable()
export class ReaderService {
  private readonly logger = new Logger(ReaderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async getReaderPayload(
    clerkUserId: string,
    libraryItemId: string,
    chapterId?: string,
  ): Promise<ReaderStatusPayload> {
    const libraryItem = await this.ownedLibraryItem(clerkUserId, libraryItemId);
    return buildReaderPayload({
      chapterId,
      libraryItem,
      logger: this.logger,
      prisma: this.prisma,
    });
  }

  // Lightweight resume-position read for the offline primer's progress-bucket
  // revalidation (see specs/4-offline/4.4-cache-priming): just the progress summary, no
  // chapter loading.
  async getProgress(
    clerkUserId: string,
    libraryItemId: string,
  ): Promise<ReaderProgressSummary> {
    const libraryItem = await this.ownedLibraryItem(clerkUserId, libraryItemId);
    return createProgressSummary(libraryItem.progress);
  }

  async updateProgress(
    clerkUserId: string,
    libraryItemId: string,
    locator: ReaderLocator,
    readAt?: string,
  ): Promise<ReaderProgressSummary> {
    validateLocator(locator);
    const libraryItem = await this.ownedLibraryItem(clerkUserId, libraryItemId);
    return updateReadingProgress(
      this.prisma,
      libraryItem,
      libraryItemId,
      locator,
      readAt,
    );
  }

  async markReaderOpened(clerkUserId: string, libraryItemId: string) {
    const libraryItem = await this.ownedLibraryItem(clerkUserId, libraryItemId);

    await this.prisma.libraryItem.update({
      where: {
        id: libraryItem.id,
      },
      data: {
        lastOpenedAt: new Date(),
      },
    });
  }

  private ownedLibraryItem(clerkUserId: string, libraryItemId: string) {
    return getOwnedLibraryItem(
      this.prisma,
      this.usersService,
      clerkUserId,
      libraryItemId,
    );
  }
}
