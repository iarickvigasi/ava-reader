import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getOwnedLibraryItem } from './library-item-access';
import { validateLocator } from './progress/locator';
import { createProgressSummary } from './progress/progress-summary';
import { updateReadingProgress } from './progress/update-progress';
import { buildReaderPayload } from './reader-payload';
import type {
  ReaderProgressSummary,
  ReaderStatusPayload,
} from './reader-payload-types';
import type { ReaderLocator } from './reader-types';
import {
  resolveOfflineReplay,
  type OfflineReplayRequest,
} from './sessions/resolve-offline-replay';
import { runSessionAction } from './sessions/run-session-action';
import { serializeSession } from './sessions/session-record';
import { validateClientInstanceId } from './sessions/session-validators';
import { startReadingSession } from './sessions/start-session';

const NO_OFFLINE_REPLAY: OfflineReplayRequest = {
  clientSessionId: null,
  endedAt: null,
  startedAt: null,
};

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
  // revalidation (see specs/11-cache-priming): just the progress summary, no
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

  async startSession(
    clerkUserId: string,
    libraryItemId: string,
    clientInstanceId: string,
    offlineReplay: OfflineReplayRequest = NO_OFFLINE_REPLAY,
  ) {
    validateClientInstanceId(clientInstanceId);
    const now = new Date();
    const replay = resolveOfflineReplay(offlineReplay);

    if (replay.clamped) {
      this.logger.warn(
        `Clamping offline replay session ${offlineReplay.clientSessionId} duration ` +
          `${replay.requestedSeconds}s to ${replay.durationSeconds}s`,
      );
    }

    const libraryItem = await this.ownedLibraryItem(clerkUserId, libraryItemId);
    const session = await startReadingSession({
      clientInstanceId,
      libraryItemId,
      now,
      prisma: this.prisma,
      replay,
      userId: libraryItem.userId,
    });

    return serializeSession(session);
  }

  async heartbeatSession(
    clerkUserId: string,
    libraryItemId: string,
    sessionId: string,
    clientInstanceId: string,
  ) {
    return this.applySessionAction(
      'heartbeat',
      clerkUserId,
      libraryItemId,
      sessionId,
      clientInstanceId,
    );
  }

  async stopSession(
    clerkUserId: string,
    libraryItemId: string,
    sessionId: string,
    clientInstanceId: string,
  ) {
    return this.applySessionAction(
      'stop',
      clerkUserId,
      libraryItemId,
      sessionId,
      clientInstanceId,
    );
  }

  private async applySessionAction(
    action: 'heartbeat' | 'stop',
    clerkUserId: string,
    libraryItemId: string,
    sessionId: string,
    clientInstanceId: string,
  ) {
    const session = await runSessionAction({
      action,
      clerkUserId,
      clientInstanceId,
      libraryItemId,
      prisma: this.prisma,
      sessionId,
      usersService: this.usersService,
    });

    return serializeSession(session);
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
