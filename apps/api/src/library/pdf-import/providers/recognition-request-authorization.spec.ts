import { recognitionResponse } from '../../../pdf-conversion/reconstruction/recognition-response';
import { response } from '../../../pdf-conversion/reconstruction/test-fixture';
import { wireSegment } from '../../../pdf-conversion/reconstruction/wire-segment-fixture';
import { prepareProviderRequest } from './prepare-request';
import { jsonHash } from './hash';
import {
  recognitionProviderTask,
  recognitionRoute,
  recognitionTask,
} from './recognition-request-fixture';

it.each(['missing-image', 'extra-image', 'prompt', 'schema'])(
  'refuses invalid recognition %s before JSON projection',
  (change) => {
    const value = structuredClone(recognitionProviderTask),
      content = value.messages[1].content;
    if (typeof content === 'string') throw new Error('fixture');
    if (change === 'missing-image') content.pop();
    if (change === 'extra-image') content.push(structuredClone(content[1]));
    if (change === 'prompt') value.messages[0].content = 'Foreign prompt';
    if (change === 'schema') value.responseSchema = {};
    expect(() => prepareProviderRequest(recognitionRoute, value)).toThrow();
  },
);

it('binds recognition guidance to the exact request and current byte limit', () => {
  const prepared = prepareProviderRequest(
    recognitionRoute,
    recognitionProviderTask,
  );
  const body = JSON.parse(prepared.request.toString()) as {
    messages: typeof recognitionProviderTask.messages;
  };
  body.messages = recognitionProviderTask.messages;
  expect(jsonHash(body)).not.toBe(prepared.requestSha256);
  expect(() =>
    prepareProviderRequest(
      {
        ...recognitionRoute,
        configuration: {
          ...recognitionRoute.configuration,
          maxRequestBytes: prepared.request.length - 1,
        },
      },
      recognitionProviderTask,
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_LIMIT');
});

it.each([
  'invalid-json',
  'missing-table-cells',
  'source',
  'task',
  'render',
  'page',
  'essential-unknown',
])(
  'refuses JSON-mode recognition %s without inventing a valid result',
  (change) => {
    prepareProviderRequest(recognitionRoute, recognitionProviderTask);
    const segment: Record<string, unknown> = { ...wireSegment };
    const raw = { ...response, segments: [segment] };
    if (change === 'missing-table-cells') {
      segment.kind = 'table';
      delete segment.cells;
    }
    if (change === 'source') raw.source_sha256 = 'f'.repeat(64);
    if (change === 'task') raw.task_id = 'foreign-task';
    if (change === 'render') raw.render_sha256 = 'f'.repeat(64);
    if (change === 'page') raw.segments[0].page = 2;
    if (change === 'essential-unknown')
      raw.unresolved = ['Illegible essential source'];
    const before = JSON.stringify(raw);
    const bytes = change === 'invalid-json' ? '{' : before;
    expect(() => recognitionResponse(recognitionTask, bytes)).toThrow();
    expect(JSON.stringify(raw)).toBe(before);
  },
);
