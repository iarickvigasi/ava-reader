import { recognitionSchemas } from '../../../pdf-conversion/reconstruction/generated/schemas';
import { providerRequestFormat } from './request-format';
import { providerResponseSchema } from './response-schema';
import { prepareProviderRequest } from './prepare-request';
import { nativeProviderTask, nativeRoute } from './native-request-fixture';
import { jsonHash } from './hash';
import { task, route } from './test-fixtures';

it('uses Gemini JSON mode with a separate host contract and unchanged source/image parts', () => {
  const before = JSON.stringify(nativeProviderTask);
  const prepared = prepareProviderRequest(nativeRoute, nativeProviderTask);
  const body = JSON.parse(prepared.request.toString()) as {
    messages: typeof nativeProviderTask.messages;
    response_format: object;
  };
  const original = nativeProviderTask.messages[1].content;
  const content = body.messages[1].content;
  if (typeof original === 'string' || typeof content === 'string')
    throw new Error('fixture');
  expect(body.response_format).toEqual({ type: 'json_object' });
  expect(body.messages[0]).toEqual(nativeProviderTask.messages[0]);
  expect(content.slice(1)).toEqual(original);
  expect(content.filter((part) => part.type === 'image_url')).toHaveLength(1);
  expect(content[0].type).toBe('text');
  if (content[0].type !== 'text') throw new Error('fixture');
  const [guidance, schema] = content[0].text.split('\n');
  expect(guidance).toContain('not PDF source content');
  expect(JSON.parse(schema)).toEqual(
    providerResponseSchema(nativeRoute.modelId, nativeProviderTask),
  );
  expect(JSON.stringify(nativeProviderTask)).toBe(before);
  expect(prepared.taskSha256).toBe(jsonHash(nativeProviderTask));
  expect(prepared.requestSha256).toBe(jsonHash(body));
  expect(
    prepareProviderRequest(nativeRoute, structuredClone(nativeProviderTask))
      .requestSha256,
  ).toBe(prepared.requestSha256);
});

it('preserves non-Gemini Native2 messages and canonical strict schema', () => {
  const prepared = prepareProviderRequest(
    { ...nativeRoute, modelId: route.modelId },
    nativeProviderTask,
  );
  const body = JSON.parse(prepared.request.toString()) as {
    messages: unknown;
    response_format: unknown;
  };
  expect(body.messages).toEqual(nativeProviderTask.messages);
  expect(body.response_format).toEqual({
    type: 'json_schema',
    json_schema: {
      name: 'ava_pdf_result',
      strict: true,
      schema: nativeProviderTask.responseSchema,
    },
  });
});

it.each([
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
] as const)(
  'retains exact historical %s format and message projection',
  (name, version) => {
    const value = {
      ...task,
      schemaVersion: version,
      responseSchema: recognitionSchemas[name],
    };
    const modelId = 'google/gemini-contract-control';
    const format = providerRequestFormat(modelId, value);
    expect(JSON.stringify(format)).toBe(
      JSON.stringify({
        messages: value.messages,
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'ava_pdf_result',
            strict: true,
            schema: providerResponseSchema(modelId, value),
          },
        },
      }),
    );
  },
);
