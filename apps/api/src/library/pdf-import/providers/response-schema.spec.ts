import { recognitionGenerationSchema } from './recognition-generation-schema';
import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { providerResponseSchema } from './response-schema';
import { geminiRecognitionSchema } from './gemini-schema';
import { prepareProviderRequest } from './prepare-request';
import { route, task } from './test-fixtures';
import { jsonHash } from './hash';
import {
  recognitionProviderTask as recognition,
  recognitionRoute,
} from './recognition-request-fixture';

it('selects only Gemini recognition v2 while retaining full task identity', () => {
  expect(providerResponseSchema(route.modelId, recognition)).toBe(
    recognition.responseSchema,
  );
  expect(providerResponseSchema('google/gemini-3.8-flash', task)).toBe(
    task.responseSchema,
  );
  const encoded = prepareProviderRequest(recognitionRoute, recognition);
  const body = JSON.parse(encoded.request.toString()) as {
    response_format: object;
  };
  expect(body.response_format).toEqual({
    type: 'json_schema',
    json_schema: {
      name: 'ava_recognition_observation',
      strict: true,
      schema: recognitionGenerationSchema(),
    },
  });
  expect(providerResponseSchema(recognitionRoute.modelId, recognition)).toEqual(
    geminiRecognitionSchema(recognition.responseSchema),
  );
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

it('retains the non-Gemini recognition canonical strict schema and original messages', () => {
  const prepared = prepareProviderRequest(
    { ...recognitionRoute, modelId: route.modelId },
    recognition,
  );
  const body = JSON.parse(prepared.request.toString()) as {
    messages: unknown;
    response_format: unknown;
  };
  expect(body.messages).toEqual(recognition.messages);
  expect(body.response_format).toEqual({
    type: 'json_schema',
    json_schema: {
      name: 'ava_pdf_result',
      strict: true,
      schema: recognition.responseSchema,
    },
  });
});
