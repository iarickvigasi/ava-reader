import { validateReconstructionInput } from './validate-input';
import type { SemanticValidator } from '../contracts/types';
import { validateCompletion } from '../contracts/validate-completion';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type {
  CoordinatorDependencies,
  CoordinatorInput,
} from './coordinator-types';
import { preparePages } from './prepare-pages';
import { refineBook } from './refine-book';
import { streamReconstruction } from './stream-reconstruction';
import { candidateEnvelope } from './candidate-envelope';

export async function runReconstruction(
  input: CoordinatorInput,
  deps: CoordinatorDependencies,
  semantic: SemanticValidator,
  workerFingerprint: string,
) {
  const { job, jobBytes, source } = await validateReconstructionInput(
    input,
    semantic,
    workerFingerprint,
  );
  const deadline = performance.now() + job.active_deadline_seconds * 1000;
  const sandboxInput = (): SandboxInput => {
    if (input.signal.aborted)
      throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    const deadlineMs = Math.floor(deadline - performance.now());
    if (deadlineMs <= 0) throw new PdfRuntimeError('EXECUTION_TIMEOUT');
    return {
      source,
      jobBytes,
      module: 'ava_pdf_epub.reconstruction_v2',
      deadlineMs,
      scratchBytes: job.scratch_byte_limit,
      signal: input.signal,
      leaseRemainingMs: input.leaseRemainingMs,
    };
  };
  const prepared = await preparePages({
    deps,
    sandboxInput,
    sourceSha256: job.source.sha256,
    pageLimit: job.source_page_limit,
    providerMode: job.provider_mode,
    profileId: job.profile_id,
  });
  await deps.progress({ stage: 'RECONSTRUCTION' });
  const refinements = await refineBook({
    responses: prepared.responses,
    deps,
    sandboxInput,
    sourceSha256: job.source.sha256,
    providerMode: job.provider_mode,
    profileId: job.profile_id,
  });
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'reconstruct_stream',
      input: {
        schema_version: 'ava-reconstruct-input-1',
        source_feature_policy: 'ava-ocr-source-features-1',
        profile_id: job.profile_id,
        source_sha256: job.source.sha256,
        responses: prepared.responses,
        refinements,
      },
    }),
  );
  if (auxiliaryBytes.length > 64 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const { stagedByPath, book, reportBytes, header, report } =
    await streamReconstruction(deps, sandboxInput, auxiliaryBytes, semantic);
  if (
    !book ||
    !reportBytes ||
    JSON.stringify(reportBytes) !== JSON.stringify(report) ||
    report.profile_id !== job.profile_id ||
    book.profile_id !== job.profile_id ||
    report.page_count !== prepared.pageCount ||
    report.recognition_task_count !== prepared.taskCount
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const bytes = Buffer.from(
    JSON.stringify(candidateEnvelope(job, book, report, header.artifacts)),
  );
  const completion = { exitCode: 2, bytes };
  await validateCompletion(job, completion, semantic);
  await deps.progress({ stage: 'VALIDATION' });
  return {
    completion,
    stagedByPath,
    metadata: book.metadata,
    profileId: book.profile_id,
  };
}
