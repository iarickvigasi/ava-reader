import { PdfRuntimeError } from './runtime-error';
import type { PendingExchangeTask } from './exchange-tasks';

export function wordWrapExchangeTasks(payload: unknown): PendingExchangeTask[] {
  const packet = payload as {
    schema_version?: unknown;
    tasks?: unknown;
  } | null;
  if (
    packet?.schema_version !== 'ava-native-word-wrap-batch-1' ||
    !Array.isArray(packet.tasks) ||
    packet.tasks.length > 32
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const tasks = packet.tasks.map(
    (task: { task_id?: unknown; schema_version?: unknown } | null) => {
      if (
        task?.schema_version !== 'ava-native-word-wrap-task-1' ||
        typeof task.task_id !== 'string' ||
        !task.task_id.length
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      return { id: task.task_id, kind: 'word_wrap' as const };
    },
  );
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length)
    throw new PdfRuntimeError('INVALID_RESULT');
  return tasks;
}
