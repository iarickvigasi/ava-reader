import { nativeStructureResponse } from './native-structure-response';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';
import { validatePacket } from './validate-packet';

const parse = (value: unknown) =>
  nativeStructureResponse(nativeTask, JSON.stringify(value));
const changed = (mutate: (value: NativeStructureResponse) => void) => {
  const value = structuredClone(nativeResponse);
  mutate(value);
  return value;
};

it('retains only source-ID groups, pinned boundary decisions and eligible source-span references', () => {
  expect(parse(nativeResponse)).toEqual(nativeResponse);
  expect(() => validatePacket('RecognitionResponse', nativeResponse)).toThrow(
    'INVALID_RESULT',
  );
  expect(
    parse({ ...nativeResponse, unresolved: ['source uncertainty'] }).unresolved,
  ).toEqual(['source uncertainty']);
});

it.each([
  'task_id',
  'source_sha256',
  'observation_sha256',
  'render_sha256',
] as const)('refuses a changed %s identity', (field) => {
  expect(() =>
    parse({
      ...nativeResponse,
      [field]: field === 'task_id' ? 'foreign-task' : 'f'.repeat(64),
    }),
  ).toThrow('SOURCE_MISMATCH');
});

it.each([
  { text: 'replacement prose' },
  { segments: [] },
  { box: nativeTask.lines[0].box },
  { style: nativeTask.lines[0].style },
  { method: 'ocr' },
])('refuses replacement/transcription authority %j', (extra) => {
  expect(() => parse({ ...nativeResponse, ...extra })).toThrow(
    'INVALID_RESULT',
  );
  expect(() =>
    parse({
      ...nativeResponse,
      groups: [
        { ...nativeResponse.groups[0], ...extra },
        ...nativeResponse.groups.slice(1),
      ],
    }),
  ).toThrow('INVALID_RESULT');
});

it.each([
  (r: NativeStructureResponse) => {
    r.groups[0].line_ids.pop();
  },
  (r: NativeStructureResponse) => {
    r.groups[0].line_ids.push(r.groups[0].line_ids[0]);
  },
  (r: NativeStructureResponse) => {
    r.groups[0].line_ids.reverse();
  },
  (r: NativeStructureResponse) => {
    r.groups[0].region_id = 'notes';
  },
  (r: NativeStructureResponse) => {
    r.groups[1].id = r.groups[0].id;
  },
  (r: NativeStructureResponse) => {
    r.groups[0].kind = 'furniture';
  },
])(
  'refuses missing, repeated, reordered or reclassified source coverage',
  (mutate) => {
    expect(() => parse(changed(mutate))).toThrow('SOURCE_MISMATCH');
  },
);
