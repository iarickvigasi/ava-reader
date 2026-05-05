import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Blobs are written outside the metadata transaction (see
// LibraryService.importBook). On failure, we best-effort delete them,
// but if that cleanup itself fails the bytes linger as orphans. This
// service sweeps them up.
const ORPHAN_BLOB_AGE_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

@Injectable()
export class OrphanBlobCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrphanBlobCleanupService.name);
  private poller: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.poller = setInterval(() => {
      void this.sweepOnce();
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  async sweepOnce() {
    if (this.isTickRunning) {
      return 0;
    }

    this.isTickRunning = true;

    try {
      const cutoff = new Date(Date.now() - ORPHAN_BLOB_AGE_MS);
      const result = await this.prisma.storedBlob.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          bookCoverFor: { none: {} },
          bookFiles: { none: {} },
          feedbackAttachments: { none: {} },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Deleted ${result.count} orphan blob(s).`);
      }

      return result.count;
    } catch (error) {
      this.logger.error('Orphan blob cleanup failed.', error);
      return 0;
    } finally {
      this.isTickRunning = false;
    }
  }
}
