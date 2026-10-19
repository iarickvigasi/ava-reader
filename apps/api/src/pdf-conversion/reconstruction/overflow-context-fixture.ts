// Authored Python-model-valid controls, never supplied-book or paid-fidelity evidence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionOverflowContextTask } from './generated/RecognitionOverflowContextTask';
import type { RecognitionAnchorContextResponse } from './generated/RecognitionAnchorContextResponse';
const read = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      join(__dirname, 'fixtures', `overflow-context-${name}.json`),
      'utf8',
    ),
  );
export const overflowParent = read('parent-task') as RecognitionTask;
export const overflowOriginal = read('parent-response') as RecognitionResponse;
export const overflowTask = read(
  'correction-task',
) as RecognitionOverflowContextTask;
export const overflowResponse = read(
  'correction-response',
) as RecognitionAnchorContextResponse;
