import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { Tx } from '../jobs/types';
import { requirePdfReviewer } from '../review/scope';
import {
  reportId,
  safeEventSchema,
  retainedEventInput,
} from './event-contract';
import { parseEventPage, eventPageCursor } from './cursor';
import { loadConversionProjection } from './load-ledger';
import { costPage, costCursor } from './cost-cursor';

export async function adminReportRead<T>(
  prisma: PrismaService,
  reviewerId: string,
  work: (tx: Tx) => Promise<T>,
) {
  await requirePdfReviewer(prisma, reviewerId);
  const result = await prisma.$transaction(work, {
    isolationLevel: 'RepeatableRead',
    timeout: 15_000,
  });
  // Fresh check outside the snapshot: a role revoked during reads must deny delivery.
  await requirePdfReviewer(prisma, reviewerId);
  return result;
}
export async function reportRecord(tx: Tx, id: string) {
  if (!reportId.safeParse(id).success)
    throw new BadRequestException('Invalid conversion reference.');
  const record = await tx.pdfConversionInvestigation.findUnique({
    where: { id },
  });
  if (!record)
    throw new NotFoundException('Conversion investigation not found.');
  return record;
}
export function recordView(record: Awaited<ReturnType<typeof reportRecord>>) {
  return {
    conversionId: record.id,
    operationId: record.operationKey,
    bookId: record.bookId,
    libraryItemId: record.libraryItemId,
    jobId: record.jobId,
    failureId: record.failureId,
    finalContentId: record.finalContentId,
    sourceSha256: record.sourceSha256,
    sourceBytes: record.sourceBytes,
    sourcePages: record.sourcePages,
    configSha256: record.configSha256,
    profileId: record.profileId,
    workerFingerprint: record.workerFingerprint,
    status: record.status,
    stage: record.stage,
    coverage: record.coverage,
    evidenceGaps: record.evidenceGaps,
    sequenceWatermark: record.nextSequence,
    activeAdmissionCount: record.activeAdmissionCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    costSummaryId: record.id,
    retention: {
      class: record.retentionClass,
      policyConfigured: record.retentionPolicyId !== null,
      eligibleForPurgeAt: record.eligibleForPurgeAt?.toISOString() ?? null,
    },
  };
}
export async function readReportEvents(
  tx: Tx,
  id: string,
  cursor?: string,
  rawLimit?: string,
) {
  const record = await reportRecord(tx, id),
    page = parseEventPage(id, record.nextSequence, cursor, rawLimit);
  const rows = await tx.pdfConversionEvent.findMany({
    where: {
      conversionId: id,
      sequence: { gt: page.after, lte: page.watermark },
    },
    orderBy: { sequence: 'asc' },
    take: page.limit + 1,
  });
  const events = rows.slice(0, page.limit).map((row) => ({
    sequence: row.sequence,
    recordedAt: row.createdAt.toISOString(),
    ...safeEventSchema.parse(retainedEventInput(row)),
  }));
  return {
    schemaVersion: 1,
    conversionId: id,
    watermark: page.watermark,
    events,
    nextCursor:
      rows.length > page.limit
        ? eventPageCursor(id, page.watermark, events.at(-1)!.sequence)
        : null,
  };
}
export async function readReportCost(
  tx: Tx,
  id: string,
  cursor?: string,
  limit?: string,
) {
  const record = await reportRecord(tx, id);
  const stored = await tx.pdfConversionCost.findUnique({
    where: { conversionId: id },
  });
  const page = stored
    ? costPage(id, stored.ledgerWatermark, cursor, limit)
    : { offset: 0, limit: 0 };
  const current = await loadConversionProjection(
    tx,
    record.operationKey ?? id,
    ['READY', 'FAILED', 'STOPPED', 'REFUSED'].includes(record.status) &&
      (Boolean(record.operationKey) || record.activeAdmissionCount === 0),
    page,
    record.coverage !== 'HISTORICAL_SNAPSHOT',
  );
  if (!stored)
    return {
      schemaVersion: 1,
      conversionId: id,
      state: 'MISSING',
      currentLedgerWatermark: current.ledgerWatermark,
      infrastructure: current.infrastructure,
    };
  if (
    stored.version !== current.version ||
    stored.currency !== current.currency
  )
    return {
      schemaVersion: 1,
      conversionId: id,
      state: 'INCOMPLETE',
      actualComplete: false,
      reason: 'PROJECTION_INCOMPATIBLE',
      currentLedgerWatermark: current.ledgerWatermark,
      currentCallCount: current.callCount,
      infrastructure: current.infrastructure,
      calls: [],
    };
  const fresh = stored.ledgerWatermark === current.ledgerWatermark;
  const consistent =
    fresh &&
    stored.version === current.version &&
    stored.currency === current.currency &&
    stored.callCount === current.callCount &&
    stored.knownActualNano.toString() === current.knownActualNano &&
    stored.reservedNano.toString() === current.reservedNano &&
    stored.uncertainNano.toString() === current.uncertainNano &&
    stored.actualComplete === current.actualComplete &&
    stored.state === current.state;
  return {
    schemaVersion: 1,
    conversionId: id,
    currency: stored.currency,
    knownActualNano: stored.knownActualNano.toString(),
    reservedNano: stored.reservedNano.toString(),
    uncertainNano: stored.uncertainNano.toString(),
    heldExposureNano: (stored.reservedNano + stored.uncertainNano).toString(),
    actualComplete: consistent && stored.actualComplete,
    state: !fresh ? 'STALE' : consistent ? stored.state : 'INCOMPLETE',
    ledgerWatermark: stored.ledgerWatermark,
    currentLedgerWatermark: current.ledgerWatermark,
    callCount: stored.callCount,
    reconciledAt: stored.reconciledAt.toISOString(),
    infrastructure: current.infrastructure,
    ledgerCoverage: current.ledgerCoverage,
    estimatedNano: null,
    estimateStatus: 'NOT_AVAILABLE',
    breakdown: consistent ? current.breakdown : [],
    // Authoritative call fields are rebuilt through the safe allowlist, never
    // serialize the stored arbitrary JSON or private receipt/payload bodies.
    calls: consistent ? current.calls : [],
    nextCursor:
      consistent && current.callCount > page.offset + page.limit
        ? costCursor(id, stored.ledgerWatermark, page.offset + page.limit)
        : null,
  };
}
