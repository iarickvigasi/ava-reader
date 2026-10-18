import { assertLocalCellGeometryPolicy } from './local-cell-geometry-policy';
import { localizeCellGeometry } from './local-cell-geometry';
import type { LocalCellOcrPolicy } from '../../library/pdf-import/admission/cell-ocr-policy';
import { validateRefinement } from './validate-refinement';
import { validateGeometry } from './validate-geometry';
import { validateWordWrap } from './validate-word-wrap';
import type {
  NativeLayoutPolicy,
  NativeStructurePolicy,
  SourceNormalizationPolicy,
  RecognitionRepairPolicy,
  SourceTitlePolicy,
  SourceContinuationPolicy,
} from '../../library/pdf-import/admission/profile';
import { reconstructionRequest } from './reconstruction-request';
import type { SemanticValidator } from '../contracts/types';
import type { SandboxInput } from '../runtime/container-arguments';
import { PdfRuntimeError } from '../runtime/runtime-error';
import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import { attemptExchanges } from './attempt-exchanges';
import { reconstructionSink } from './reconstruction-sink';
import { validateSourceFeatures } from '../../library/pdf-import/publication/source-report-features';
import { validateAnchorContext } from './validate-anchor-context';

export async function runAttempt(
  input: {
    deps: CoordinatorDependencies;
    sandboxInput: () => SandboxInput;
    sourceSha256: string;
    pageLimit: number;
    providerMode: string;
    profileId: RecognitionTask['profile_id'];
    sourceLayoutPolicy?: NativeLayoutPolicy;
    sourceStructurePolicy?: NativeStructurePolicy;
    sourceNormalizationPolicy?: SourceNormalizationPolicy;
    recognitionRepairPolicy?: RecognitionRepairPolicy;
    sourceTitlePolicy?: SourceTitlePolicy;
    sourceContinuationPolicy?: SourceContinuationPolicy;
    localCellGeometryPolicy?: LocalCellOcrPolicy;
  },
  semantic: SemanticValidator,
) {
  assertLocalCellGeometryPolicy(input);
  let runtimeSignal: AbortSignal | undefined;
  const checkActive = (signal = runtimeSignal) => {
    input.sandboxInput();
    if (signal?.aborted) throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  };
  const exchanges = attemptExchanges({
    ...input,
    checkActive,
    validateContinuation: (task, response, signal) =>
      validateRefinement(
        task,
        response,
        input.deps.sandbox,
        input.sandboxInput,
        signal,
      ),
    validateFrontmatterTitle: (task, response, signal) =>
      validateRefinement(
        task,
        response,
        input.deps.sandbox,
        input.sandboxInput,
        signal,
      ),
    localizeCellGeometry: (task, original, signal) =>
      localizeCellGeometry(
        task,
        original,
        input.deps.sandbox,
        input.sandboxInput,
        signal,
      ),
    validateGeometry: (task, original, signal) =>
      validateGeometry(
        task,
        original,
        input.deps.sandbox,
        input.sandboxInput,
        signal,
      ),
    validateWordWrap: (task, signal) =>
      validateWordWrap(task, input.deps.sandbox, input.sandboxInput, signal),
    validateAnchorContext: (correction, task, signal) =>
      validateAnchorContext(
        correction,
        task,
        input.deps.sandbox,
        input.sandboxInput,
        signal,
      ),
  });
  const sink = reconstructionSink(input.deps, checkActive, semantic);
  const result = await input.deps.sandbox({
    ...input.sandboxInput(),
    auxiliaryBytes: Buffer.from(
      JSON.stringify({
        mode: 'attempt_stream',
        input: reconstructionRequest(input),
      }),
    ),
    observationCommand: { command: 'attempt_stream', page_number: null },
    onExchange: (bytes, signal) => {
      runtimeSignal = signal;
      return exchanges.exchange(bytes, signal);
    },
    onStdout: (chunk) => sink.write(chunk),
  });
  // A naturally completed transport closes its session signal. Only the outer
  // job remains live here; all paid/staging actions already checked both signals.
  input.sandboxInput();
  const prepared = exchanges.finish(result.exitCode);
  const output = sink.finish();
  try {
    validateSourceFeatures(output.report, output.book, true);
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
  return { ...prepared, ...output };
}
