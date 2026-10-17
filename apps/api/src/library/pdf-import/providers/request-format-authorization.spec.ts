import { nativeStructure2Response } from '../../../pdf-conversion/reconstruction/native-structure-v2-response';
import { prepareProviderRequest } from './prepare-request';
import {
  nativeProviderTask,
  nativeRoute,
  nativeTask2,
  nativeResponse2,
} from './native-request-fixture';
import { jsonHash } from './hash';

it.each([
  'prompt',
  'schema',
  'public-source',
  'purpose',
  'missing-image',
  'extra-image',
])('refuses invalid Native2 %s before projecting to JSON mode', (change) => {
  const value = structuredClone(nativeProviderTask);
  const content = value.messages[1].content;
  if (typeof content === 'string') throw new Error('fixture');
  if (change === 'prompt') value.messages[0].content = 'Foreign prompt';
  if (change === 'schema') value.responseSchema = {};
  if (change === 'purpose') value.purpose = 'transcribe_region';
  if (change === 'public-source' && content[0].type === 'text') {
    const view = JSON.parse(content[0].text) as Record<string, unknown>;
    view.source_sha256 = 'f'.repeat(64);
    content[0].text = JSON.stringify(view);
  }
  if (change === 'missing-image') content.pop();
  if (change === 'extra-image') content.push(structuredClone(content[1]));
  expect(() => prepareProviderRequest(nativeRoute, value)).toThrow();
});

it('includes contract guidance in the existing byte limit and exact request identity', () => {
  const prepared = prepareProviderRequest(nativeRoute, nativeProviderTask);
  expect(() =>
    prepareProviderRequest(
      {
        ...nativeRoute,
        configuration: {
          ...nativeRoute.configuration,
          maxRequestBytes: prepared.request.length - 1,
        },
      },
      nativeProviderTask,
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_LIMIT');
  const body = JSON.parse(prepared.request.toString()) as {
    messages: typeof nativeProviderTask.messages;
  };
  body.messages = nativeProviderTask.messages;
  expect(prepared.requestSha256).not.toBe(jsonHash(body));
});

it('preserves a valid typed canonical result without rewriting provider bytes', () => {
  prepareProviderRequest(nativeRoute, nativeProviderTask);
  const response = structuredClone(nativeResponse2);
  response.groups.reverse();
  const output = JSON.stringify(response);
  expect(nativeStructure2Response(nativeTask2, output)).toEqual(response);
  expect(JSON.stringify(response)).toBe(output);
});

it.each([
  'invalid-json',
  'foreign-role',
  'missing-line',
  'repeated-line',
  'foreign-reference',
  'boundary-digest',
])('does not repair or accept JSON-mode output with %s', (change) => {
  prepareProviderRequest(nativeRoute, nativeProviderTask);
  const response = structuredClone(nativeResponse2);
  if (change === 'foreign-role')
    Object.assign(response.groups[0], { chapter_role: 'bodymatter' });
  if (change === 'missing-line') response.groups[0].line_ids.pop();
  if (change === 'repeated-line')
    response.groups[0].line_ids.push(response.groups[0].line_ids[0]);
  if (change === 'foreign-reference')
    response.references[0].span_id = 'foreign';
  if (change === 'boundary-digest')
    response.boundary_dispositions[0].candidate_sha256 = 'f'.repeat(64);
  expect(() =>
    nativeStructure2Response(
      nativeTask2,
      change === 'invalid-json' ? '{' : JSON.stringify(response),
    ),
  ).toThrow();
});
