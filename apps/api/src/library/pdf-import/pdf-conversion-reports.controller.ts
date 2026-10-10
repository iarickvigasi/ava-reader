import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import {
  adminReportRead,
  reportRecord,
  recordView,
  readReportEvents,
  readReportCost,
} from './reports/read';
import { reportId } from './reports/event-contract';
import { readObservationCoverage } from './reports/read-observation-coverage';
const lookupSchema = z
  .object({
    operationId: reportId.optional(),
    bookId: reportId.optional(),
    libraryItemId: reportId.optional(),
    failureId: reportId.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).filter(Boolean).length === 1);
@Controller('admin/pdf-conversion-reports')
@UseGuards(ClerkAuthGuard)
export class PdfConversionReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  private async read<T>(
    request: AuthenticatedRequest,
    work: Parameters<typeof adminReportRead<T>>[2],
  ) {
    const reviewer = await this.users.assertAdmin(request.auth.clerkUserId);
    return adminReportRead(this.prisma, reviewer.id, work);
  }
  @Get('lookup')
  @Header('Cache-Control', 'private, no-store')
  lookup(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const parsed = lookupSchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException('Invalid conversion lookup.');
    const value = parsed.data;
    return this.read(request, async (tx) => {
      const rows = await tx.pdfConversionInvestigation.findMany({
        where: {
          ...(value.operationId ? { operationKey: value.operationId } : {}),
          ...(value.bookId ? { bookId: value.bookId } : {}),
          ...(value.libraryItemId
            ? { libraryItemId: value.libraryItemId }
            : {}),
          ...(value.failureId ? { failureId: value.failureId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 21,
      });
      return {
        schemaVersion: 1,
        results: rows.slice(0, 20).map(recordView),
        complete: rows.length <= 20,
      };
    });
  }
  @Get(':conversionId')
  @Header('Cache-Control', 'private, no-store')
  snapshot(
    @Req() request: AuthenticatedRequest,
    @Param('conversionId') id: string,
  ) {
    return this.read(request, async (tx) => {
      const record = await reportRecord(tx, id);
      return {
        schemaVersion: 1,
        ...recordView(record),
        observationCoverage: await readObservationCoverage(
          tx,
          id,
          record.nextSequence,
        ),
      };
    });
  }
  @Get(':conversionId/events')
  @Header('Cache-Control', 'private, no-store')
  events(
    @Req() request: AuthenticatedRequest,
    @Param('conversionId') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.read(request, (tx) => readReportEvents(tx, id, cursor, limit));
  }
  @Get(':conversionId/cost')
  @Header('Cache-Control', 'private, no-store')
  cost(
    @Req() request: AuthenticatedRequest,
    @Param('conversionId') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.read(request, (tx) => readReportCost(tx, id, cursor, limit));
  }
  @Get(':conversionId/export')
  @Header('Cache-Control', 'private, no-store')
  export(
    @Req() request: AuthenticatedRequest,
    @Param('conversionId') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.read(request, async (tx) => {
      const record = await reportRecord(tx, id);
      const timeline = await readReportEvents(tx, id, cursor, limit);
      const result = {
        schemaVersion: 1,
        investigation: {
          ...recordView(record),
          observationCoverage: await readObservationCoverage(
            tx,
            id,
            timeline.watermark,
          ),
        },
        timeline,
        cost: await readReportCost(tx, id),
      };
      if (Buffer.byteLength(JSON.stringify(result)) > 512 * 1024)
        throw new PayloadTooLargeException(
          'Report page exceeds its export limit.',
        );
      return result;
    });
  }
}
