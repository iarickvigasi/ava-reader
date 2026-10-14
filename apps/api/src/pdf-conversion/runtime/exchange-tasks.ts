import { PdfRuntimeError } from './runtime-error';
export type PendingExchangeTask = {
  id: string;
  kind: 'recognition' | 'native_structure' | 'refinement' | 'word_wrap';
};

export function exchangeTasks(
  payload: unknown,
  maximum: number,
  refinement = false,
): PendingExchangeTask[] {
  const packet = payload as {
    tasks?: unknown;
    schema_version?: unknown;
  } | null;
  const tasks = packet?.tasks;
  if (!Array.isArray(tasks) || tasks.length > maximum)
    throw new PdfRuntimeError('INVALID_RESULT');
  const current = [
    'ava-prepare-result-3',
    'ava-prepare-result-4',
    'ava-prepare-result-5',
  ].includes(String(packet?.schema_version));
  const nativeMarker =
    packet?.schema_version === 'ava-prepare-result-5'
      ? 'ava-native-structure-task-2'
      : 'ava-native-structure-task-1';
  const pending = tasks.map(
    (task: { task_id?: unknown; schema_version?: unknown } | null) => {
      const native = task?.schema_version === nativeMarker;
      const anyNative = [
        'ava-native-structure-task-1',
        'ava-native-structure-task-2',
      ].includes(String(task?.schema_version));
      if (
        typeof task?.task_id !== 'string' ||
        !task.task_id.length ||
        (anyNative && (!current || refinement)) ||
        (current &&
          ![nativeMarker, 'ava-recognition-task-1'].includes(
            String(task.schema_version),
          ))
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      return {
        id: task.task_id,
        kind: refinement
          ? ('refinement' as const)
          : native
            ? ('native_structure' as const)
            : ('recognition' as const),
      };
    },
  );
  if (new Set(pending.map((task) => task.id)).size !== pending.length)
    throw new PdfRuntimeError('INVALID_RESULT');
  return pending;
}
