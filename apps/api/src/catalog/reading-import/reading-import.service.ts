import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { ingestImport } from './ingest-import';
import { loadImport } from './load-import';
import { publishReadingImport } from './publish-reading-import';
@Injectable()
export class ReadingImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  async ingest(userId: string, json: string, file: Express.Multer.File) {
    const admin = await this.users.assertAdmin(userId);
    return ingestImport(this.prisma, admin.id, json, file);
  }
  async status(userId: string, editionId: string, checksum: string) {
    await this.users.assertAdmin(userId);
    return (await loadImport(this.prisma, editionId, checksum)).receipt;
  }
  async publish(userId: string, body: Record<string, unknown>) {
    const admin = await this.users.assertAdmin(userId);
    return publishReadingImport(this.prisma, admin.id, body);
  }
}
