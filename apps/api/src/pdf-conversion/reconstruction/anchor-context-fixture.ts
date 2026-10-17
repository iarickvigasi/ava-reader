// Authored Python-model-valid controls; transport/dispatch are mocked, not visual-fidelity proof.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorContextResponse } from './generated/RecognitionAnchorContextResponse';
function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(
      join(__dirname, 'fixtures', `anchor-context-${name}.json`),
      'utf8',
    ),
  );
}
export const anchorParent = fixture('parent-task') as RecognitionTask;
export const anchorOriginal = fixture('parent-response') as RecognitionResponse;
export const anchorTask = fixture(
  'correction-task',
) as RecognitionAnchorContextTask;
export const anchorResponse = fixture(
  'correction-response',
) as RecognitionAnchorContextResponse;
