import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { jsonHash } from './hash';
import { geminiRecognitionSchema } from './gemini-schema';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
import { nativeStructureGenerationSchema } from './native-structure-generation-schema';
// Records the projection revision; actual schema bytes change request hashes.
// Canonical task identity and accepted response semantics remain unchanged.
export const GEMINI_GRAMMAR_VERSION = 'ava-gemini-recognition-grammar-4';
export function providerResponseSchema(modelId: string, task: ProviderTask) {
  const schema =
    task.schemaVersion === 'ava-native-structure-response-2'
      ? recognitionSchemas.NativeStructureResponse2
      : task.schemaVersion === 'ava-recognition-response-2'
        ? recognitionSchemas.RecognitionResponse
        : task.schemaVersion === 'ava-printed-title-response-2'
          ? recognitionSchemas.FrontmatterTitleResponse
          : task.schemaVersion === 'ava-book-refinement-response-3'
            ? recognitionSchemas.BookRefinementResponse
            : task.schemaVersion === 'ava-printed-title-response-1'
              ? recognitionSchemas.PrintedTitleResponse
              : task.schemaVersion === 'ava-recognition-geometry-response-1'
                ? recognitionSchemas.RecognitionGeometryResponse
                : task.schemaVersion ===
                    'ava-recognition-anchor-context-response-1'
                  ? recognitionSchemas.RecognitionAnchorContextResponse
                  : task.schemaVersion === 'ava-book-refinement-response-4'
                    ? recognitionSchemas.SourceFeatureResponse
                    : task.schemaVersion === 'ava-native-word-wrap-response-1'
                      ? recognitionSchemas.WordWrapResponse
                      : task.schemaVersion === 'ava-native-structure-response-1'
                        ? recognitionSchemas.NativeStructureResponse
                        : null;
  if (!modelId.startsWith('google/gemini-') || !schema)
    return task.responseSchema;
  if (jsonHash(task.responseSchema) !== jsonHash(schema))
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  const grammar = geminiRecognitionSchema(
    task.responseSchema,
    task.schemaVersion,
  );
  return task.schemaVersion === 'ava-native-structure-response-2'
    ? nativeStructureGenerationSchema(grammar, task)
    : grammar;
}
