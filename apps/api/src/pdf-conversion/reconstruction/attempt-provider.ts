import type { NativeLayoutPolicy } from '../../library/pdf-import/admission/profile';
import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RefinementTask } from './refinement-packets';
import { refinementResponse } from './refinement-response';
import { providerTask } from './provider-task';
import { refinementProviderTask } from './refinement-provider-task';
import { recognitionResponse } from './recognition-response';

export type AttemptContext = {
  deps: CoordinatorDependencies;
  sourceSha256: string;
  profileId: RecognitionTask['profile_id'];
  providerMode: string;
  pageLimit: number;
  sourceLayoutPolicy?: NativeLayoutPolicy;
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
