import type { AttemptContext } from './attempt-provider';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import { nativeStructureProviderTask } from './native-structure-provider-task';
import { nativeStructureResponse } from './native-structure-response';

export async function resolveNativeStructureAttemptTask(
  task: NativeStructureTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    nativeStructureProviderTask(task, context.sourceSha256, task.page_number),
    signal,
  );
  context.checkActive(signal);
  return nativeStructureResponse(task, receipt.output);
}
