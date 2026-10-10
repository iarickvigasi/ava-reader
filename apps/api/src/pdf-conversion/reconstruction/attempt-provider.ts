import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import { providerTask } from './provider-task';
import { refinementProviderTask } from './refinement-provider-task';
import { recognitionResponse } from './recognition-response';
import { parsePacket } from './validate-packet';

export type AttemptContext = {
  deps: CoordinatorDependencies;
  sourceSha256: string;
  profileId: RecognitionTask['profile_id'];
  providerMode: string;
  pageLimit: number;
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
  task: BookRefinementTask | SourceFeatureTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    refinementProviderTask(task, context.sourceSha256),
    signal,
  );
  context.checkActive(signal);
  return parsePacket(
    task.response_schema_version === 'ava-book-refinement-response-4'
      ? 'SourceFeatureResponse'
      : 'BookRefinementResponse',
    Buffer.from(receipt.output),
    2 * 1024 ** 2,
  );
}
