import type { AttemptContext } from './attempt-provider';
import type { PreparedAttemptPage } from './prepared-attempt-page';

export function observeAttemptPage(
  prepared: PreparedAttemptPage,
  context: AttemptContext,
  totalPages: number,
) {
  const native =
    prepared.native_segment_count ||
    prepared.tasks.some(
      (task) =>
        task.schema_version === 'ava-native-structure-task-1' ||
        task.schema_version === 'ava-native-structure-task-2',
    );
  const recognitionTasks = prepared.tasks.filter(
    (task) => task.schema_version === 'ava-recognition-task-1',
  ).length;
  context.deps.observer?.emit(
    'SOURCE_INSPECTED',
    'PAGE_ROUTE',
    context.deps.observer.nextUnit('page-route'),
    {
      sourcePages: totalPages,
      preparedRoute: {
        pageNumber: prepared.page_number,
        route: recognitionTasks
          ? native
            ? 'HYBRID'
            : 'RECOGNITION'
          : native
            ? 'NATIVE'
            : 'BLANK',
        nativeSegments: prepared.native_segment_count,
        recognitionTasks,
      },
    },
  );
}
