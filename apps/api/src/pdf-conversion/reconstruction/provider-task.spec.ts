import { providerTask } from './provider-task';
import { recognitionResponse } from './recognition-response';
import { parsePacket } from './validate-packet';
import { task, response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';

it('maps only the pinned task with zero-based provider page identity', () => {
  const mapped = providerTask(task, task.source_sha256, 1);
  expect(mapped.pageIndices).toEqual([0]);
  expect(mapped.messages[0].role).toBe('system');
  expect(mapped.taskId).toBe(task.task_id);
  expect(mapped.messages).toHaveLength(2);
});
it.each([
  { source_sha256: 'c'.repeat(64) },
  { page_number: 2 },
  { native_evidence: 'changed hidden text' },
  { image: { ...task.image, sha256: 'd'.repeat(64) } },
  { image: { ...task.image, base64: task.image.base64 + ' ' } },
  { region_box: { ...task.region_box, x1: 900 } },
])('refuses altered source/render evidence before dispatch: %p', (change) => {
  expect(() =>
    providerTask({ ...task, ...change }, task.source_sha256, 1),
  ).toThrow();
});
it.each([
  { task_id: 'other' },
  { render_sha256: 'd'.repeat(64) },
  { source_sha256: 'e'.repeat(64) },
])('refuses a reply for another source/task/render', (change) => {
  expect(() =>
    recognitionResponse(task, JSON.stringify({ ...response, ...change })),
  ).toThrow('SOURCE_MISMATCH');
});
it('requires strict JSON and never treats a markdown explanation as transcript', () => {
  expect(() =>
    recognitionResponse(task, '```json\n' + JSON.stringify(response) + '\n```'),
  ).toThrow('INVALID_RESULT');
  expect(() =>
    parsePacket('RecognitionResponse', Buffer.from('{}'), 1),
  ).toThrow('RESOURCE_LIMIT');
  expect(recognitionResponse(task, JSON.stringify(response)).language).toBe(
    'en',
  );
});

it('rejects segments from another page even when reply identity matches', () => {
  const segment = {
    ...wireSegment,
    id: 'segment-1',
    page: 2,
    kind: 'paragraph',
    method: 'ocr',
    box: wireSegment.box,
    text: 'Wrong page',
  };
  expect(() =>
    recognitionResponse(
      task,
      JSON.stringify({
        ...response,
        segments: [segment],
      }),
    ),
  ).toThrow('SOURCE_MISMATCH');
});

it.each([
  { unresolved: ['illegible text'] },
  { language: 'fr' },
  {
    segments: [
      {
        ...wireSegment,
        id: 's',
        page: 1,
        kind: 'unsupported',
        method: 'ocr',
        box: wireSegment.box,
      },
    ],
  },
])(
  'stops on declared recognition refusal before another paid task',
  (change) => {
    expect(() =>
      recognitionResponse(task, JSON.stringify({ ...response, ...change })),
    ).toThrow('UNSUPPORTED_PDF');
  },
);
