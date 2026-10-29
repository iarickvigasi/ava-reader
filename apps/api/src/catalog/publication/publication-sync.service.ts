import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { syncPublication } from './sync-publication';

@Injectable()
export class PublicationSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() {
    if (process.env.NODE_ENV !== 'test')
      this.timer = setInterval(() => {
        void this.flush();
      }, 10_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const entries = await this.prisma.catalogEntry.findMany({
        where: { importSyncPending: true },
        orderBy: { updatedAt: 'asc' },
        take: 5,
        select: { id: true },
      });
      for (const entry of entries) {
        try {
          await this.prisma.catalogEntry.updateMany({
            where: { id: entry.id, importSyncPending: true },
            data: { updatedAt: new Date() },
          });
          await syncPublication(this.prisma, entry.id);
        } catch (error) {
          this.logger.warn(
            `[${entry.id}] ${error instanceof Error ? error.message : 'Publication synchronization failed'}`,
          );
        }
      }
    } catch {
      this.logger.warn('Cannot read pending publications');
    } finally {
      this.running = false;
    }
  }
}
