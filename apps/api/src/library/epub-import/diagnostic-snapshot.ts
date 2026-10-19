import { reportId } from '../pdf-import/reports/event-contract';
import type { Tx } from '../pdf-import/jobs/types';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
export const EPUB_DIAGNOSTIC_COVERAGE = 'EPUB_PREPARATION';
export const epubInvestigationId = (runId: string) => `epub-run-${runId}`;
export async function epubDiagnosticSnapshot(tx: Tx, runId: string) {
  const run = await tx.bookProcessingRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      sourceFile: {
        include: { blob: { select: { checksum: true, sizeBytes: true } } },
      },
    },
  });
  if (
    run.pipeline !== CANONICAL_EPUB_PIPELINE ||
    !run.canonicalOwnerId ||
    !run.canonicalLibraryItemId
  )
    throw new Error('EPUB_DIAGNOSTIC_IDENTITY_INVALID');
  const source = run.sourceFile;
  if (
    !source ||
    source.bookId !== run.bookId ||
    source.kind !== 'SOURCE' ||
    source.format !== 'EPUB' ||
    !/^[a-f0-9]{64}$/.test(source.blob.checksum) ||
    !Number.isSafeInteger(source.blob.sizeBytes) ||
    source.blob.sizeBytes < 0 ||
    ![
      run.id,
      run.bookId,
      run.canonicalOwnerId,
      run.canonicalLibraryItemId,
      run.canonicalContentId,
    ].every((id) => reportId.safeParse(id).success)
  )
    throw new Error('EPUB_DIAGNOSTIC_SOURCE_INVALID');
  const identity = {
    ownerId: run.canonicalOwnerId,
    bookId: run.bookId,
    libraryItemId: run.canonicalLibraryItemId,
    jobId: run.id,
    sourceSha256: source.blob.checksum,
    sourceBytes: source.blob.sizeBytes,
  };
  const id = epubInvestigationId(run.id);
  const prior = await tx.pdfConversionInvestigation.findUnique({
    where: { id },
  });
  if (
    prior &&
    (prior.operationId !== null ||
      prior.operationKey !== null ||
      prior.coverage !== EPUB_DIAGNOSTIC_COVERAGE ||
      (Object.keys(identity) as Array<keyof typeof identity>).some(
        (key) => prior[key] !== identity[key],
      ))
  )
    throw new Error('EPUB_DIAGNOSTIC_IDENTITY_INVALID');
  const prepared = run.outputFileId
    ? await tx.canonicalEpubImport.findUnique({
        where: { readerFileId: run.outputFileId },
        select: { validatorFingerprint: true },
      })
    : null;
  const data = {
    ...identity,
    profileId: null,
    configSha256: null,
    sourcePages: null,
    workerFingerprint: prepared?.validatorFingerprint ?? null,
    status: run.status,
    finalContentId: run.status === 'READY' ? run.canonicalContentId : null,
  };
  const record = await tx.pdfConversionInvestigation.upsert({
    where: { id },
    create: {
      id,
      ...data,
      stage: run.status === 'READY' ? 'EPUB_ACTIVATION' : 'EPUB_QUEUE',
      coverage: EPUB_DIAGNOSTIC_COVERAGE,
      evidenceGaps: [
        'COORDINATOR_ONLY_NO_WORKER_INTERNAL_METRICS',
        'COORDINATOR_DURATIONS_EXCLUDE_DIAGNOSTIC_WRITES',
        'BEST_EFFORT_DIAGNOSTICS',
        'FIRST_OCCURRENCE_PER_FENCE',
        ...(run.attemptCount > 1 || run.outputFileId
          ? ['HISTORY_BEFORE_CAPTURE']
          : []),
      ],
    },
    update: data,
  });
  return { run, record };
}
