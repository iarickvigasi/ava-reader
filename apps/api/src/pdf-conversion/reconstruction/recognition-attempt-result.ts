import type { RecognitionTask } from './generated/RecognitionTask';
import { recognitionResponse } from './recognition-response';
import { ResponseValidationError } from './response-validation-error';
import { overflowRecognitionCandidate } from './overflow-recognition-candidate';
import { unwrapOverflowCandidate } from './overflow-candidate-packet';

export function recognitionAttemptResult(
  task: RecognitionTask,
  output: string,
  allowOverflow: boolean,
) {
  try {
    return {
      response: recognitionResponse(task, output),
      originalResponseJson: output,
      pendingOverflow: false,
    };
  } catch (error) {
    if (!(error instanceof ResponseValidationError) || !allowOverflow)
      throw error;
    const original = unwrapOverflowCandidate(task, output);
    return {
      response: overflowRecognitionCandidate(task, original),
      originalResponseJson: original,
      pendingOverflow: true,
    };
  }
}
