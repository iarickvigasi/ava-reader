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

it('canonicalizes equivalent hex style colours without changing text or hashes', () => {
  const observed = {
    ...response,
    segments: [
      {
        ...wireSegment,
        text: '#F5A623',
        style: { id: 'orange', color: '#F5A623' },
        spans: [
          {
            start: 0,
            end: 7,
            note_label: null,
            target_text: null,
            url: null,
            style: { id: 'inline', color: '#AaBBcC' },
          },
        ],
      },
    ],
  };
  const accepted = recognitionResponse(task, JSON.stringify(observed));
  expect(accepted.segments[0].style?.color).toBe('#f5a623');
  expect(accepted.segments[0].spans[0].style?.color).toBe('#aabbcc');
  expect(accepted.segments[0].text).toBe('#F5A623');
  expect(accepted.source_sha256).toBe(observed.source_sha256);
  expect(observed.segments[0].style.color).toBe('#F5A623');
});
it.each(['red', '#abc', '#12345G', ' #ABCDEF', '#ABCDEF '])(
  'still rejects malformed style colour %s',
  (color) => {
    expect(() =>
      recognitionResponse(
        task,
        JSON.stringify({
          ...response,
          segments: [{ ...wireSegment, style: { id: 'invalid', color } }],
        }),
      ),
    ).toThrow('INVALID_RESULT');
  },
);

it('selects span-aware instructions only for the versioned merged-table task', () => {
  const legacy = providerTask(task, task.source_sha256, 1);
  const merged = providerTask(
    { ...task, prompt_version: 'ava-prose-region-3' },
    task.source_sha256,
    1,
  );
  expect(legacy.messages[0].content).not.toContain('MERGED TABLES:');
  expect(merged.messages[0].content).toContain('MERGED TABLES:');
  expect(merged.promptVersion).toBe('ava-prose-region-3');
});

it('selects pinned geometry only for its new task version', () => {
  const pinned = providerTask(
    { ...task, prompt_version: 'ava-prose-region-4' },
    task.source_sha256,
    1,
  );
  const historical = providerTask(
    { ...task, prompt_version: 'ava-prose-region-3' },
    task.source_sha256,
    1,
  );
  expect(pinned.messages[0].content).toContain('source_cell_id');
  expect(pinned.messages[0].content).toContain('box:null');
  expect(historical.messages[0].content).not.toContain('source_cell_id');
  expect(pinned.promptVersion).toBe('ava-prose-region-4');
});

it.each(['ava-prose-region-5', 'ava-prose-region-6'] as const)(
  'requires explicit style objects for %s',
  (version) => {
    const request = providerTask(
      { ...task, prompt_version: version },
      task.source_sha256,
      1,
    );
    expect(request.messages[0].content).toContain('never a string ID');
    expect(request.promptVersion).toBe(version);
    const historical = providerTask(
      { ...task, prompt_version: 'ava-prose-region-2' },
      task.source_sha256,
      1,
    );
    expect(historical.messages[0].content).not.toContain('STYLE ENCODING:');
  },
);

it.each([
  'ava-prose-region-7',
  'ava-prose-region-8',
  'ava-prose-region-9',
  'ava-prose-region-10',
  'ava-prose-region-11',
  'ava-prose-region-12',
] as const)(
  'requests exact inline quotations without numeric counting for %s',
  (version) => {
    const request = providerTask(
      { ...task, prompt_version: version },
      task.source_sha256,
      1,
    );
    expect(request.messages[0].content).toContain('anchor.before');
    expect(request.messages[0].content).toContain('Do not count characters');
    expect(request.messages[0].content).not.toContain(
      'Span start/end are half-open',
    );
    expect(request.messages[0].content).toContain('never a string ID');
    expect(
      typeof request.messages[0].content === 'string' &&
        request.messages[0].content.includes('box:null'),
    ).toBe(
      [
        'ava-prose-region-8',
        'ava-prose-region-10',
        'ava-prose-region-12',
      ].includes(version),
    );
    expect(request.promptVersion).toBe(version);
    if (['ava-prose-region-11', 'ava-prose-region-12'].includes(version)) {
      expect(request.messages[0].content).toContain('TEXT AND TYPOGRAPHY:');
      expect(request.messages[0].content).toContain('FINAL INLINE CHECK:');
    } else {
      expect(request.messages[0].content).not.toContain('TEXT AND TYPOGRAPHY:');
    }
  },
);
