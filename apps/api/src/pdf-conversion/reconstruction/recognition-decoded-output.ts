import { PdfRuntimeError } from '../runtime/runtime-error';
import type { RecognitionTask } from './generated/RecognitionTask';
import { recognitionResponse } from './recognition-response';
import { ResponseValidationError } from './response-validation-error';
import { overflowRecognitionCandidate } from './overflow-recognition-candidate';
import { overflowCandidatePacket } from './overflow-candidate-packet';

// Native JSON decoding may retain a closed raw candidate; it never accepts an invalid anchor.
// Ordinary/legacy consumers still reject the explicit candidate packet as noncanonical.
export function recognitionDecodedOutput(
  task: RecognitionTask,
  output: string,
): string {
  try {
    return JSON.stringify(recognitionResponse(task, output));
  } catch (error) {
    if (!(error instanceof ResponseValidationError)) throw error;
    try {
      return overflowCandidatePacket(
        task,
        overflowRecognitionCandidate(task, output),
      );
    } catch (recoveryError) {
      // An ineligible overflow probe must not erase the original safe finding.
      // Preserve stronger source/resource failures discovered by the probe.
      if (
        recoveryError instanceof PdfRuntimeError &&
        recoveryError.code === 'INVALID_RESULT'
      )
        throw error;
      throw recoveryError;
    }
  }
}
