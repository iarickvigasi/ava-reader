import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { providerResponseSchema } from './response-schema';
import { geminiRecognitionSchema } from './gemini-schema';
import { prepareProviderRequest } from './prepare-request';
import { route, task } from './test-fixtures';
import { jsonHash } from './hash';
const recognition = {
  ...task,
  schemaVersion: 'ava-recognition-response-2',
  responseSchema: recognitionSchemas.RecognitionResponse,
};
it('selects only Gemini recognition v2 while retaining full task identity', () => {
  expect(providerResponseSchema(route.modelId, recognition)).toBe(
    recognition.responseSchema,
  );
  expect(providerResponseSchema('google/gemini-3.8-flash', task)).toBe(
    task.responseSchema,
  );
  const configured = {
    ...route,
    modelId: 'google/gemini-3.8-flash',
    configuration: {
      ...(route.configuration as object),
      schemaHashes: {
        [recognition.schemaVersion]: jsonHash(recognition.responseSchema),
      },
    },
  };
  const encoded = prepareProviderRequest(configured, recognition);
  const body = JSON.parse(encoded.request.toString()) as {
    response_format: { json_schema: { strict: boolean; schema: unknown } };
  };
  expect(body.response_format.json_schema).toMatchObject({
    strict: true,
    schema: geminiRecognitionSchema(recognition.responseSchema),
  });
  expect(encoded.taskSha256).toBe(jsonHash(recognition));
});
it('refuses a changed recognition contract and retains original prompt authorization', () => {
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', {
      ...recognition,
      responseSchema: {},
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
  expect(() =>
    prepareProviderRequest(
      { ...route, modelId: 'google/gemini-3.8-flash' },
      recognition,
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});

it.each([
  ['RecognitionResponse', 'ava-recognition-response-2'],
  ['FrontmatterTitleResponse', 'ava-printed-title-response-2'],
  ['BookRefinementResponse', 'ava-book-refinement-response-3'],
  ['PrintedTitleResponse', 'ava-printed-title-response-1'],
  ['RecognitionGeometryResponse', 'ava-recognition-geometry-response-1'],
  [
    'RecognitionAnchorContextResponse',
    'ava-recognition-anchor-context-response-1',
  ],
  ['SourceFeatureResponse', 'ava-book-refinement-response-4'],
  ['WordWrapResponse', 'ava-native-word-wrap-response-1'],
  ['NativeStructureResponse', 'ava-native-structure-response-1'],
] as const)('preserves historical %s generation bytes', (name, version) => {
  const responseSchema = recognitionSchemas[name];
  const value = { ...task, responseSchema, schemaVersion: version };
  expect(
    JSON.stringify(providerResponseSchema('google/gemini-control', value)),
  ).toBe(JSON.stringify(geminiRecognitionSchema(responseSchema, version)));
});
