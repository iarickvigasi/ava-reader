import { validateReconstructionInput } from './validate-input';
import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { validateCompletion } from '../contracts/validate-completion';
import { artifactStream } from '../runtime/artifact-stream';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parsePacket, validatePacket } from './validate-packet';
import type { ReconstructionReport } from './generated/ReconstructionReport';
import type {
  CoordinatorDependencies,
  CoordinatorInput,
} from './coordinator-types';
import { preparePages } from './prepare-pages';
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
  });
  await deps.progress({ stage: 'RECONSTRUCTION' });
  const auxiliaryBytes = Buffer.from(
    JSON.stringify({
      mode: 'reconstruct_stream',
      input: {
        schema_version: 'ava-reconstruct-input-1',
        source_sha256: job.source.sha256,
        responses: prepared.responses,
      },
    }),
  );
  if (auxiliaryBytes.length > 64 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const stagedByPath: Record<string, string> = {};
  let book: CanonicalBookV2 | undefined,
    reportBytes: ReconstructionReport | undefined;
  const sink = artifactStream(async (descriptor, bytes) => {
    sandboxInput();
    if (descriptor.path === 'canonical.json')
      book = await validateContract('ava-book-2', bytes, semantic);
    if (descriptor.path === 'reconstruction-report.json')
      reportBytes = parsePacket('ReconstructionReport', bytes, 8 * 1024 ** 2);
    stagedByPath[descriptor.path] = await deps.stageArtifact(descriptor, bytes);
  });
  const result = await deps.sandbox({
    ...sandboxInput(),
    auxiliaryBytes,
    onStdout: (chunk) => sink.write(chunk),
  });
  if (result.exitCode !== 0) throw new PdfRuntimeError('INVALID_RESULT');
  const header = sink.finish(),
    report = validatePacket('ReconstructionReport', header.report);
  if (
    !book ||
    !reportBytes ||
    JSON.stringify(reportBytes) !== JSON.stringify(report) ||
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
  return { completion, stagedByPath, metadata: book.metadata };
}
