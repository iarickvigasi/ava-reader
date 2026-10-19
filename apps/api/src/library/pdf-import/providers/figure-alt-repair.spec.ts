import { prepareFigureAltRepair } from './figure-alt-repair';
import {
  figureResponse,
  figureParent,
  prepareFigure,
  figureAnswer,
} from './figure-alt-fixture';
import {
  observationTask,
  observationRoute,
} from './recognition-observation-fixture';
import { recognitionObservationDecoder } from './recognition-observation-output';
import { prepareProviderRequest } from './prepare-request';
import {
  FIGURE_ALT_PROMPT,
  FIGURE_ALT_PROMPT_VERSION,
  FIGURE_ALT_SCHEMA,
  FIGURE_ALT_SCHEMA_VERSION,
} from './figure-alt-contract';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
const decode = recognitionObservationDecoder(observationTask);
it('patches only absent descriptions while preserving original bytes, images and all observations', () => {
  const original = figureResponse();
  original.segments.push({
    ...structuredClone(original.segments[0]),
    id: 'second',
    text: 'é 😀 ²',
    alt: 'Existing description',
  });
  const bytes = JSON.stringify(original),
    repair = prepareFigure(original),
    answer = figureAnswer(repair);
  const expected = structuredClone(original);
  expected.segments[0].alt = answer.patches[0].alt;
  expect(repair.apply(JSON.stringify(answer))).toBe(
    decode(JSON.stringify(expected)),
  );
  expect(JSON.stringify(original)).toBe(bytes);
  const correction = repair.task.messages[1].content,
    parent = observationTask.messages[1].content;
  expect(typeof correction).not.toBe('string');
  expect(typeof parent).not.toBe('string');
  expect(correction[1]).toEqual(parent[1]);
});
it.each([
  'alt-null',
  'alt-invalid',
  'extra',
  'missing-text',
  'missing-box',
  'unresolved',
  'duplicate-id',
  'old-wire',
  'no-figure',
  'unsupported-language',
])('does not repair %s', (fault) => {
  const raw = figureResponse();
  if (fault === 'alt-null') raw.segments[0].alt = null;
  if (fault === 'alt-invalid') raw.segments[0].alt = 42;
  if (fault === 'extra') raw.segments[0].unexpected = true;
  if (fault === 'missing-text') delete raw.segments[0].text;
  if (fault === 'missing-box') delete raw.segments[0].box;
  if (fault === 'unresolved') (raw.unresolved as string[]).push('illegible');
  if (fault === 'duplicate-id')
    raw.segments.push(structuredClone(raw.segments[0]));
  if (fault === 'old-wire')
    raw.schema_version = 'ava-recognition-observation-1';
  if (fault === 'no-figure') raw.segments[0].kind = 'paragraph';
  if (fault === 'unsupported-language') raw.language = 'und';
  expect(() => prepareFigure(raw)).toThrow();
});
it('rejects duplicate keys, malformed JSON, excess figures and oversized parent before dispatch', () => {
  for (const bad of [
    '{',
    JSON.stringify(figureResponse()).replace(
      '"language":',
      '"language":"en","language":',
    ),
    ' '.repeat(8 * 1024 ** 2 + 1),
  ])
    expect(() =>
      prepareFigureAltRepair(observationTask, bad, figureParent, decode),
    ).toThrow();
  const raw = figureResponse();
  raw.segments = Array.from({ length: 9 }, (_, i) => ({
    ...raw.segments[0],
    id: `s${i}`,
  }));
  expect(() => prepareFigure(raw)).toThrow();
});
it.each([
  'wrong-parent',
  'wrong-task',
  'unknown-id',
  'extra-patch',
  'missing-patch',
  'blank',
  'too-long',
  'null',
  'unresolved',
  'extra-field',
])('rejects %s corrective output without a second opportunity', (fault) => {
  const repair = prepareFigure(),
    answer = figureAnswer(repair);
  if (fault === 'wrong-parent') answer.parent_output_sha256 = 'b'.repeat(64);
  if (fault === 'wrong-task') answer.task_id += 'x';
  if (fault === 'unknown-id') answer.patches[0].segment_id = 'other';
  if (fault === 'extra-patch') answer.patches.push(answer.patches[0]);
  if (fault === 'missing-patch') answer.patches = [];
  if (fault === 'blank') answer.patches[0].alt = '  ';
  if (fault === 'too-long') answer.patches[0].alt = 'x'.repeat(1001);
  if (fault === 'null') Object.assign(answer.patches[0], { alt: null });
  if (fault === 'unresolved') {
    answer.outcome = 'unresolved';
    answer.patches = [];
  }
  if (fault === 'extra-field')
    Object.assign(answer.patches[0], { text: 'rewritten' });
  expect(() => repair.apply(JSON.stringify(answer))).toThrow();
});
it('binds deterministic identity to parent output, original request and call', () => {
  const raw = figureResponse(),
    output = JSON.stringify(raw),
    a = prepareFigure(raw);
  expect(prepareFigure(raw).task.taskId).toBe(a.task.taskId);
  for (const parent of [
    { ...figureParent, callId: 'other' },
    { ...figureParent, requestSha256: 'b'.repeat(64) },
  ])
    expect(
      prepareFigureAltRepair(observationTask, output, parent, decode).task
        .taskId,
    ).not.toBe(a.task.taskId);
  raw.segments[0].text = 'Different source observation';
  expect(prepareFigure(raw).task.taskId).not.toBe(a.task.taskId);
});
it('requires explicit route allowlisting and respects output reservation bounds', () => {
  const task = prepareFigure().task;
  expect(() => prepareProviderRequest(observationRoute, task)).toThrow(
    'PDF_PROVIDER_REQUEST_UNAUTHORIZED',
  );
  const route = {
    ...observationRoute,
    configuration: {
      ...observationRoute.configuration,
      promptHashes: {
        ...observationRoute.configuration.promptHashes,
        [FIGURE_ALT_PROMPT_VERSION]: checksumBuffer(
          Buffer.from(FIGURE_ALT_PROMPT),
        ),
      },
      schemaHashes: {
        ...observationRoute.configuration.schemaHashes,
        [FIGURE_ALT_SCHEMA_VERSION]: jsonHash(FIGURE_ALT_SCHEMA),
      },
    },
  };
  const prepared = prepareProviderRequest(route, task);
  expect(prepared.requestSha256).toBeTruthy();
  const request = JSON.parse(prepared.request.toString()) as {
    response_format: { json_schema: { schema: object } };
  };
  expect(
    JSON.stringify(request.response_format.json_schema.schema),
  ).not.toMatch(/"(?:\$defs|const|maxLength|minLength|pattern)":/);
  expect(request.response_format.json_schema.schema).toMatchObject({
    properties: { schema_version: { enum: ['ava-figure-alt-response-1'] } },
  });
  expect(task.maxOutputTokens).toBeLessThanOrEqual(4096);
});

it.each(['\ud800', '\udc00'])(
  'rejects malformed literal and escaped Unicode without replacement',
  (malformed) => {
    const repair = prepareFigure(),
      answer = figureAnswer(repair);
    answer.patches[0].alt = malformed;
    const encoded = JSON.stringify(answer);
    expect(() => repair.apply(encoded)).toThrow();
    expect(() =>
      repair.apply(
        encoded.replace(/\\u[dD][89a-fA-F][0-9a-fA-F]{2}/g, malformed),
      ),
    ).toThrow();
  },
);
it('preserves valid Unicode descriptions exactly', () => {
  const repair = prepareFigure(),
    answer = figureAnswer(repair);
  const alt = 'É e\u0301 😀 A₁ ⇕ B₁';
  answer.patches[0].alt = alt;
  const result = JSON.parse(repair.apply(JSON.stringify(answer))) as {
    segments: { alt: string }[];
  };
  expect(result.segments[0].alt).toBe(alt);
});

it('batches multiple absent descriptions once and refuses reordered patches', () => {
  const raw = figureResponse();
  raw.segments.push({
    ...structuredClone(raw.segments[0]),
    id: 'existing',
    alt: 'Keep exactly',
  });
  raw.segments.push({
    ...structuredClone(raw.segments[0]),
    id: 'second',
    text: 'Second diagram',
  });
  const repair = prepareFigure(raw),
    answer = figureAnswer(repair);
  expect(answer.patches).toHaveLength(2);
  const expected = structuredClone(raw);
  expected.segments[0].alt = answer.patches[0].alt;
  expected.segments[2].alt = answer.patches[1].alt;
  expect(repair.apply(JSON.stringify(answer))).toBe(
    decode(JSON.stringify(expected)),
  );
  answer.patches.reverse();
  expect(() => repair.apply(JSON.stringify(answer))).toThrow();
});
