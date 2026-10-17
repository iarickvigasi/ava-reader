import { nativeStructureResponse } from './native-structure-response';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';

const parse = (value: unknown) =>
  nativeStructureResponse(nativeTask, JSON.stringify(value));
const changed = (mutate: (value: NativeStructureResponse) => void) => {
  const value = structuredClone(nativeResponse);
  mutate(value);
  return value;
};

it.each([
  (r: NativeStructureResponse) => {
    r.boundary_dispositions = [];
  },
  (r: NativeStructureResponse) => {
    r.boundary_dispositions.push(r.boundary_dispositions[0]);
  },
  (r: NativeStructureResponse) => {
    r.boundary_dispositions[0].candidate_id = 'foreign';
  },
  (r: NativeStructureResponse) => {
    r.boundary_dispositions[0].candidate_sha256 = 'f'.repeat(64);
  },
  (r: NativeStructureResponse) => {
    r.references[0].span_id = 'foreign-source-span';
  },
  (r: NativeStructureResponse) => {
    r.references.push(r.references[0]);
  },
])(
  'refuses changed boundary scope/digests and foreign/repeated source references',
  (mutate) => {
    expect(() => parse(changed(mutate))).toThrow('SOURCE_MISMATCH');
  },
);

it('refuses output text, label, destination, style and offsets on source-span references', () => {
  for (const extra of [
    { exact_text: '1' },
    { note_label: 'invented' },
    { url: 'https://example.test' },
    { start: 1 },
    { style: {} },
  ])
    expect(() =>
      parse({
        ...nativeResponse,
        references: [{ ...nativeResponse.references[0], ...extra }],
      }),
    ).toThrow('INVALID_RESULT');
});
