import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterClient } from '../shared/openrouter-client';
import { recordFailedAttempt } from './chapter-purpose/record-failure';
import { CHAPTER_PURPOSE_PIPELINE } from './chapter-purpose/request-analysis';
import { runChapterPurposeAnalysis } from './chapter-purpose/run-analysis';
import { claimNextRun, closeRun, type ClaimedRun } from './processing-run';

const POLL_INTERVAL_MS = 2_000;

/**
 * Runs book-scoped AI analyses in the background.
 *
 * Deliberately a separate poller from `ReaderProcessingService` rather than a
 * stage inside it: a flaky third-party API must never stall EPUB processing,
 * and an analysis needs to re-run on its own schedule when a prompt version
 * changes.
 */
@Injectable()
export class BookAnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookAnalysisService.name);
  private poller: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly openrouter: OpenRouterClient,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.poller = setInterval(() => {
      void this.processPendingRunsOnce();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  async processPendingRunsOnce(): Promise<boolean> {
    if (this.isTickRunning) {
      return false;
    }

    this.isTickRunning = true;

    try {
      const run = await claimNextRun({
        pipeline: CHAPTER_PURPOSE_PIPELINE,
        prisma: this.prisma,
      });

      if (!run) {
        return false;
      }

      await this.processRun(run);
      return true;
    } finally {
      this.isTickRunning = false;
    }
  }

  private async processRun(run: ClaimedRun) {
    try {
      await runChapterPurposeAnalysis({
        bookId: run.bookId,
        model: this.openrouter.getModel(),
        modelId: this.openrouter.getModelId(),
        prisma: this.prisma,
      });

      await closeRun({
        errorMessage: null,
        prisma: this.prisma,
        runId: run.id,
      });
    } catch (error) {
      const message = describe(error);
      this.logger.warn(
        `Chapter-purpose analysis failed for book ${run.bookId}: ${message}`,
      );

      await recordFailedAttempt({
        bookId: run.bookId,
        errorMessage: message,
        prisma: this.prisma,
      });
      // Always closed out, even if the attempt counter could not be written —
      // otherwise the pipeline stalls on a PROCESSING row.
      await closeRun({
        errorMessage: message,
        prisma: this.prisma,
        runId: run.id,
      });
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown analysis error.';
}
