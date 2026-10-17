import type { NativeStructureTask2 } from './generated/NativeStructureTask2';
import { nativeStructure2ProviderTask } from './native-structure-v2-provider-task';
import { nativeStructure2Response } from './native-structure-v2-response';
import type { AttemptContext } from './attempt-provider';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import { nativeStructureProviderTask } from './native-structure-provider-task';
import { nativeStructureResponse } from './native-structure-response';

export async function resolveNativeStructureAttemptTask(
  task: NativeStructureTask | NativeStructureTask2,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    task.schema_version === 'ava-native-structure-task-2'
      ? nativeStructure2ProviderTask(
          task,
          context.sourceSha256,
          task.page_number,
        )
      : nativeStructureProviderTask(
          task,
          context.sourceSha256,
          task.page_number,
        ),
    signal,
  );
  context.checkActive(signal);
  return task.schema_version === 'ava-native-structure-task-2'
    ? nativeStructure2Response(task, receipt.output)
    : nativeStructureResponse(task, receipt.output);
}
