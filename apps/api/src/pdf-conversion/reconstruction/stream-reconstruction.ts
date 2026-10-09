import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { SemanticValidator } from '../contracts/types';
import { validateContract } from '../contracts/validate-contract';
import { artifactStream } from '../runtime/artifact-stream';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { parsePacket, validatePacket } from './validate-packet';
import type { ReconstructionReport } from './generated/ReconstructionReport';
import type { CoordinatorDependencies } from './coordinator-types';
import { sourceRefusalStream } from './source-refusal-stream';
import { checksumBuffer } from '../../shared/blob-utils';

export async function streamReconstruction(
  deps: CoordinatorDependencies,
  sandboxInput: () => SandboxInput,
  auxiliaryBytes: Buffer,
  semantic: SemanticValidator,
) {
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
  const input = sandboxInput();
  const transfer = sourceRefusalStream(checksumBuffer(input.source), (chunk) =>
    sink.write(chunk),
  );
  const result = await deps.sandbox({
    ...input,
    auxiliaryBytes,
    observationCommand: { command: 'reconstruct_stream', page_number: null },
    onStdout: (chunk) => transfer.write(chunk),
  });
  transfer.finish(result.exitCode);
  if (result.exitCode !== 0) throw new PdfRuntimeError('INVALID_RESULT');
  const header = sink.finish(),
    report = validatePacket('ReconstructionReport', header.report);
  return { stagedByPath, book, reportBytes, header, report };
}
