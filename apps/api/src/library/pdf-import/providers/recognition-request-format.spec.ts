import { recognitionResponse } from '../../../pdf-conversion/reconstruction/recognition-response';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { prepareProviderRequest } from './prepare-request';
import { providerResponseSchema } from './response-schema';
import { jsonHash } from './hash';
import {
  recognitionProviderTask,
  recognitionRoute,
  recognitionTask,
} from './recognition-request-fixture';

it('projects Gemini recognition with the exact complete contract and unchanged task/source/image', () => {
  const before = JSON.stringify(recognitionProviderTask);
  const prepared = prepareProviderRequest(
    recognitionRoute,
    recognitionProviderTask,
  );
  const body = JSON.parse(prepared.request.toString()) as {
    messages: typeof recognitionProviderTask.messages;
    response_format: object;
  };
  const original = recognitionProviderTask.messages[1].content,
    content = body.messages[1].content;
  if (typeof original === 'string' || typeof content === 'string')
    throw new Error('fixture');
  expect(body.response_format).toEqual({ type: 'json_object' });
  expect(body.messages[0]).toEqual(recognitionProviderTask.messages[0]);
  expect(content.slice(1)).toEqual(original);
  expect(content.filter((part) => part.type === 'image_url')).toHaveLength(1);
  if (content[0].type !== 'text') throw new Error('fixture');
  const [guidance, encodedSchema] = content[0].text.split('\n');
  expect(guidance).toContain('not PDF source content');
  const schema = providerResponseSchema(
    recognitionRoute.modelId,
    recognitionProviderTask,
  );
  expect(encodedSchema).toBe(JSON.stringify(schema));
  expect(JSON.stringify(recognitionProviderTask)).toBe(before);
  expect(prepared.taskSha256).toBe(jsonHash(recognitionProviderTask));
  expect(prepared.requestSha256).toBe(jsonHash(body));
  expect(
    prepareProviderRequest(
      recognitionRoute,
      structuredClone(recognitionProviderTask),
    ).requestSha256,
  ).toBe(prepared.requestSha256);
  const branches = (
    schema as {
      properties: {
        segments: {
          items: {
            anyOf: {
              required: string[];
              properties: { kind: { enum: string[] } };
            }[];
          };
        };
      };
    }
  ).properties.segments.items.anyOf;
  expect(branches).toHaveLength(7);
  for (const branch of branches)
    expect(branch.required).toEqual(
      expect.arrayContaining([
        'id',
        'page',
        'box',
        'kind',
        'text',
        'style',
        'spans',
        'method',
        'continues_from_previous',
        'continues_to_next',
        'chapter_start',
      ]),
    );
  const table = branches.find((branch) =>
    branch.properties.kind.enum.includes('table'),
  );
  expect(table?.required).toContain('cells');
  expect(table).toMatchObject({
    properties: {
      cells: { minItems: 1, maxItems: 20, items: { maxItems: 8 } },
    },
  });
});

it('keeps a valid source-bound recognition result unchanged', () => {
  prepareProviderRequest(recognitionRoute, recognitionProviderTask);
  const raw = { ...response, segments: [structuredClone(wireSegment)] };
  const bytes = JSON.stringify(raw);
  expect(recognitionResponse(recognitionTask, bytes)).toEqual(raw);
  expect(JSON.stringify(raw)).toBe(bytes);
});
