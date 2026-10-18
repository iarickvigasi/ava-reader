import type { AttemptContext } from './attempt-provider';
import type { AnchorRepairTask } from './anchor-repair-types';
import type { AnchorContextProjection } from './anchor-context-projection-evidence';

export function observeAnchorContextProjection(
  task: AnchorRepairTask,
  projection: AnchorContextProjection | undefined,
  context: AttemptContext,
) {
  if (!projection || !context.deps.observer) return;
  try {
    const observer = context.deps.observer;
    observer.emit(
      'VALIDATION',
      'ANCHOR_CONTEXT_PROJECTION',
      observer.nextUnit('anchor-context-projection'),
      {
        pageIndices: [task.page_number - 1],
        anchorContextProjection: projection,
      },
    );
  } catch {
    /* Optional safe evidence cannot change source/worker acceptance. */
  }
}
