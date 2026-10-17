import type { SemanticValidator } from '../contracts/types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { CoordinatorDependencies } from './coordinator-types';
import { sourceRefusalStream } from './source-refusal-stream';
import { checksumBuffer } from '../../shared/blob-utils';
import { reconstructionSink } from './reconstruction-sink';

export async function streamReconstruction(
  deps: CoordinatorDependencies,
  sandboxInput: () => SandboxInput,
  auxiliaryBytes: Buffer,
  semantic: SemanticValidator,
) {
  const sink = reconstructionSink(
    deps,
    () => {
      sandboxInput();
    },
    semantic,
  );
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
  return sink.finish();
}
