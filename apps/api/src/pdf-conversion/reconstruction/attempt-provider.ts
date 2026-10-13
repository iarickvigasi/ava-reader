import type {
  NativeLayoutPolicy,
  NativeStructurePolicy,
} from '../../library/pdf-import/admission/profile';
import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RefinementTask } from './refinement-packets';
import { refinementResponse } from './refinement-response';
import { providerTask } from './provider-task';
import { refinementProviderTask } from './refinement-provider-task';
import { recognitionResponse } from './recognition-response';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { anchorContextResponse } from './anchor-context-response';
import { PdfRuntimeError } from '../runtime/runtime-error';

export type AttemptContext = {
  deps: CoordinatorDependencies;
  sourceSha256: string;
  profileId: RecognitionTask['profile_id'];
  providerMode: string;
  pageLimit: number;
  sourceLayoutPolicy?: NativeLayoutPolicy;
  sourceStructurePolicy?: NativeStructurePolicy;
  validateAnchorContext?: (
    correction: RecognitionAnchorContextTask,
    task: RecognitionTask,
    signal: AbortSignal,
  ) => Promise<void>;
  checkActive: (signal: AbortSignal) => void;
};

export async function recognizeAttemptTask(
  task: RecognitionTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    providerTask(task, context.sourceSha256, task.page_number),
    signal,
  );
  context.checkActive(signal);
  return recognitionResponse(task, receipt.output);
}

export async function refineAttemptTask(
  task: RefinementTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    refinementProviderTask(task, context.sourceSha256),
    signal,
  );
  context.checkActive(signal);
  return refinementResponse(task, receipt.output);
}

export async function correctAttemptAnchorContext(
  task: RecognitionAnchorContextTask,
  parent: RecognitionTask,
  original: RecognitionResponse,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  if (!context.validateAnchorContext)
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  await context.validateAnchorContext(task, parent, signal);
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    anchorContextProviderTask(task, parent, original),
    signal,
  );
  context.checkActive(signal);
  return anchorContextResponse(task, receipt.output, parent, original);
}
