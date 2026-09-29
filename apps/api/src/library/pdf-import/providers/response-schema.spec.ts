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
