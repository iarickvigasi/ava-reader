import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import {
  anchorContextBinding,
  anchorQuoteBinding,
} from './anchor-context-binding';
import { overflowContextBinding } from './overflow-context-binding';

export function anchorRepairBinding(
  input: unknown,
  parent: RecognitionTask,
  original: RecognitionResponse,
  quoteMode = false,
) {
  if (quoteMode) return anchorQuoteBinding(input, parent, original);
  if (
    input &&
    typeof input === 'object' &&
    'schema_version' in input &&
    input.schema_version === 'ava-recognition-anchor-context-task-2'
  )
    return overflowContextBinding(input, parent, original);
  return anchorContextBinding(input, parent, original);
}
