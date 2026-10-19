import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { databaseNow } from '../jobs/transaction';
import { loadConversionProjection } from './load-ledger';
const logger = new Logger('PdfConversionReport');

// Call only while holding the existing cost lock. This projection is never a
// billing authority and its failure must not roll back a known receipt.
export async function refreshConversionCost(tx: Tx, conversionId: string) {
  const record = await tx.pdfConversionInvestigation.findUniqueOrThrow({
    where: { id: conversionId },
  });
  const projection = await loadConversionProjection(
    tx,
    record.operationKey ?? record.id,
    ['READY', 'FAILED', 'STOPPED', 'REFUSED'].includes(record.status) &&
      (Boolean(record.operationKey) || record.activeAdmissionCount === 0),
    { offset: 0, limit: 0 },
    record.coverage !== 'HISTORICAL_SNAPSHOT',
  );
  return tx.pdfConversionCost.upsert({
    where: { conversionId },
    create: {
      conversionId,
      knownActualNano: BigInt(projection.knownActualNano),
      reservedNano: BigInt(projection.reservedNano),
      uncertainNano: BigInt(projection.uncertainNano),
      actualComplete: projection.actualComplete,
      state: projection.state,
      ledgerWatermark: projection.ledgerWatermark,
      callCount: projection.callCount,
      projection: projection as Prisma.InputJsonValue,
      reconciledAt: await databaseNow(tx),
    },
    update: {
      version: projection.version,
      currency: projection.currency,
      knownActualNano: BigInt(projection.knownActualNano),
      reservedNano: BigInt(projection.reservedNano),
      uncertainNano: BigInt(projection.uncertainNano),
      actualComplete: projection.actualComplete,
      state: projection.state,
      ledgerWatermark: projection.ledgerWatermark,
      callCount: projection.callCount,
      projection: projection as Prisma.InputJsonValue,
      reconciledAt: await databaseNow(tx),
    },
  });
}
export async function isolateReportMirror(tx: Tx, work: () => Promise<void>) {
  await tx.$executeRawUnsafe('SAVEPOINT ava_pdf_report_mirror');
  try {
    await work();
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT ava_pdf_report_mirror');
    return true;
  } catch {
    // A failed connection/expired transaction cannot recover this savepoint:
    // let rollback failure propagate, preserving the existing uncertain path.
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ava_pdf_report_mirror');
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT ava_pdf_report_mirror');
    logger.warn('PDF_CONVERSION_REPORT_STALE');
    return false;
  }
}
