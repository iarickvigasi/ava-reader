import type { AttemptContext } from './attempt-provider';
import type { PrepareResult } from './generated/PrepareResult';
import type { NativeLayoutPrepareResult } from './generated/NativeLayoutPrepareResult';
import type { NativeStructurePrepareResult } from './generated/NativeStructurePrepareResult';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import type { RecognitionTask } from './generated/RecognitionTask';
import { validatePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
export type PreparedAttemptPage = Omit<
  PrepareResult | NativeLayoutPrepareResult | NativeStructurePrepareResult,
  'tasks'
> & { tasks: (RecognitionTask | NativeStructureTask)[] };

export function preparedAttemptPage(
  payload: unknown,
  context: AttemptContext,
  state: { preparedPages: number; pages?: number; batch: boolean },
): PreparedAttemptPage {
  const prepared = context.sourceStructurePolicy
    ? validatePacket('NativeStructurePrepareResult', payload)
    : context.sourceLayoutPolicy
      ? validatePacket('NativeLayoutPrepareResult', payload)
      : validatePacket('PrepareResult', payload);
  const tasks: (RecognitionTask | NativeStructureTask)[] = prepared.tasks;
  if (
    'source_layout_policy' in prepared &&
    prepared.source_layout_policy !== context.sourceLayoutPolicy
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (
    state.batch ||
    prepared.page_number !== state.preparedPages + 1 ||
    prepared.page_number > prepared.source_page_count ||
    prepared.source_sha256 !== context.sourceSha256 ||
    (prepared.profile_id ?? 'ava-pdf-prose-en-v2') !== context.profileId ||
    prepared.source_page_count > context.pageLimit ||
    (state.pages !== undefined && state.pages !== prepared.source_page_count) ||
    tasks.some(
      (task) =>
        task.source_sha256 !== context.sourceSha256 ||
        task.page_number !== prepared.page_number ||
        task.profile_id !== context.profileId ||
        (task.schema_version === 'ava-native-structure-task-1' &&
          task.observation_sha256 !== prepared.observation_sha256),
    )
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return prepared;
}
