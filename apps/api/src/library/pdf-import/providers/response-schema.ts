import {
  FIGURE_ALT_SCHEMA,
  FIGURE_ALT_SCHEMA_VERSION,
} from './figure-alt-contract';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { jsonHash } from './hash';
import { geminiRecognitionSchema } from './gemini-schema';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
import { nativeStructureGenerationSchema } from './native-structure-generation-schema';
// Records the projection revision; actual schema bytes change request hashes.
// Canonical task identity and accepted response semantics remain unchanged.
export const GEMINI_GRAMMAR_VERSION = 'ava-gemini-recognition-grammar-5';
export function providerResponseSchema(modelId: string, task: ProviderTask) {
  if (
    modelId.startsWith('google/gemini-') &&
    task.schemaVersion === FIGURE_ALT_SCHEMA_VERSION
  ) {
    if (jsonHash(task.responseSchema) !== jsonHash(FIGURE_ALT_SCHEMA))
      throw new PdfProviderError('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
    return {
      ...geminiRecognitionSchema(
        { ...FIGURE_ALT_SCHEMA, $defs: {} },
        FIGURE_ALT_SCHEMA_VERSION,
      ),
      description:
        'AVA bounded figure descriptions. Copy task and parent output identities. Return exactly the requested figure IDs in order with concise factual alt, or unresolved with no patches. Never modify other observations. Full host validation remains authoritative.',
    };
  }
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
                    'ava-recognition-anchor-quote-response-2'
                  ? recognitionSchemas.RecognitionAnchorQuoteResponse
                  : task.schemaVersion ===
                      'ava-recognition-anchor-context-response-1'
                    ? recognitionSchemas.RecognitionAnchorContextResponse
                    : task.schemaVersion === 'ava-book-refinement-response-4'
                      ? recognitionSchemas.SourceFeatureResponse
                      : task.schemaVersion === 'ava-native-word-wrap-response-1'
                        ? recognitionSchemas.WordWrapResponse
                        : task.schemaVersion ===
                            'ava-native-structure-response-1'
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
