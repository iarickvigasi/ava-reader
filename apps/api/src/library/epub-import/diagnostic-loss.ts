import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { reportId } from '../pdf-import/reports/event-contract';
import { epubInvestigationId } from './diagnostic-snapshot';
const logger = new Logger('EpubPreparationDiagnostics');
export async function recordEpubDiagnosticLoss(
  prisma: PrismaService,
  runId: string,
) {
  // This best-effort mirror cannot replace an authoritative publication/failure.
  logger.warn(
    JSON.stringify({
      code: 'EPUB_DIAGNOSTIC_WRITE_LOST',
      runId: reportId.safeParse(runId).success ? runId : 'UNAVAILABLE',
    }),
  );
  await prisma
    .$transaction(
      (tx) =>
        tx.pdfConversionInvestigation.updateMany({
          where: {
            id: epubInvestigationId(runId),
            NOT: { evidenceGaps: { has: 'EPUB_DIAGNOSTIC_WRITE_LOST' } },
          },
          data: { evidenceGaps: { push: 'EPUB_DIAGNOSTIC_WRITE_LOST' } },
        }),
      { timeout: 1000, maxWait: 1000 },
    )
    .catch(() => {});
}
