import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { jsonHash } from './hash';
import { geminiRecognitionSchema } from './gemini-schema';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
// This version changes request hashes, never task identity or accepted response semantics.
export const GEMINI_GRAMMAR_VERSION = 'ava-gemini-recognition-grammar-1';
export function providerResponseSchema(modelId: string, task: ProviderTask) {
  if (
    !modelId.startsWith('google/gemini-') ||
    task.schemaVersion !== 'ava-recognition-response-2'
  )
    return task.responseSchema;
  if (
    jsonHash(task.responseSchema) !==
    jsonHash(recognitionSchemas.RecognitionResponse)
  )
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  return geminiRecognitionSchema(task.responseSchema);
}
