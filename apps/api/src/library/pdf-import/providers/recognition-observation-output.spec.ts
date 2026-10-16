import { recognitionResponse } from '../../../pdf-conversion/reconstruction/recognition-response';
import { authoredResponse } from '../../../pdf-conversion/reconstruction/recognition-json-authored-fixture';
import { prepareProviderRequest } from './prepare-request';
import { providerTask } from '../../../pdf-conversion/reconstruction/provider-task';
import {
  authoredTask,
  observationTask,
  observationRoute,
  observationResponse,
} from './recognition-observation-fixture';
const prepared = () =>
  prepareProviderRequest(observationRoute, observationTask);
const decode = (value: unknown) =>
  prepared().decodeOutput!(JSON.stringify(value));
it('binds authored observations to trusted metadata and retains text, anchors, IDs and styling', () => {
  const input = JSON.stringify(observationResponse);
  const parsed = recognitionResponse(authoredTask, decode(observationResponse));
  expect(parsed).toEqual({
    ...authoredResponse,
    segments: [
      {
        ...authoredResponse.segments[0],
        spans: [
          {
            ...authoredResponse.segments[0].spans[0],
            style: { id: 'observed', italic: true },
          },
        ],
      },
    ],
  });
  expect(JSON.stringify(observationResponse)).toBe(input);
});
it.each(['task_id', 'source_sha256', 'render_sha256'])(
  'rejects supplied host %s even when it matches',
  (key) => {
    expect(() =>
      decode({
        ...observationResponse,
        [key]: authoredResponse[key as keyof typeof authoredResponse],
      }),
    ).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
  },
);
it.each([null, 1, 6])('rejects any supplied segment page %p', (page) => {
  const raw = structuredClone(observationResponse);
  raw.segments[0].page = page;
  expect(() => decode(raw)).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
});
it.each([null, 'observed'])('rejects any supplied inline style ID %p', (id) => {
  const raw = structuredClone(observationResponse);
  raw.segments[0].style = { id, italic: true };
  expect(() => decode(raw)).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
});
it.each([
  null,
  [],
  {},
  { ...observationResponse, schema_version: 'ava-recognition-response-2' },
  authoredResponse,
])('rejects malformed or older wire packets without interpretation', (raw) => {
  expect(() => decode(raw)).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
});
it.each(['kind', 'id', 'box'])('never fills missing observed %s', (key) => {
  const raw = structuredClone(observationResponse);
  delete raw.segments[0][key];
  expect(() => decode(raw)).toThrow('INVALID_RESULT');
});
it('preserves strict extra-field and explicit-null refusal', () => {
  expect(() => decode({ ...observationResponse, extra: true })).toThrow(
    'INVALID_RESULT',
  );
  const raw = structuredClone(observationResponse);
  raw.segments[0].alt = null;
  expect(() => decode(raw)).toThrow('INVALID_RESULT');
});
it('uses the trusted zero-based dispatch page, not a model page or later caller mutation', () => {
  const task = { ...authoredTask, page_number: 6 };
  const provider = providerTask(task, task.source_sha256, 6);
  const bound = prepareProviderRequest(observationRoute, provider);
  provider.pageIndices[0] = 7;
  expect(
    recognitionResponse(
      task,
      bound.decodeOutput!(JSON.stringify(observationResponse)),
    ).segments[0].page,
  ).toBe(6);
  expect(() =>
    recognitionResponse(
      authoredTask,
      bound.decodeOutput!(JSON.stringify(observationResponse)),
    ),
  ).toThrow('SOURCE_MISMATCH');
});

it('supplies only omitted OCR provenance from the trusted recognition task without changing observations', () => {
  const raw = structuredClone(observationResponse);
  delete raw.segments[0].method;
  const before = JSON.stringify(raw);
  expect(JSON.parse(decode(raw))).toEqual(
    JSON.parse(decode(observationResponse)),
  );
  expect(JSON.stringify(raw)).toBe(before);
});
it.each([null, 'native', 'OCR', '', 0, false])(
  'never replaces conflicting or malformed explicit provenance %p',
  (method) => {
    const raw = structuredClone(observationResponse);
    raw.segments[0].method = method;
    expect(() => decode(raw)).toThrow('INVALID_RESULT');
  },
);
