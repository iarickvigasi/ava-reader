import { recognitionResponse } from './recognition-response';
import {
  authoredTask,
  authoredResponse,
} from './recognition-json-authored-fixture';

const parse = (value: unknown) =>
  recognitionResponse(authoredTask, JSON.stringify(value));
const styled = (style: unknown) => {
  const raw = structuredClone(authoredResponse);
  return {
    ...raw,
    segments: [{ ...raw.segments[0], style }],
  };
};
it('supplies only omitted inline IDs at segment, cell and span sites', () => {
  const segment = structuredClone(authoredResponse.segments[0]);
  const raw = {
    ...authoredResponse,
    segments: [
      {
        ...segment,
        kind: 'table',
        style: { bold: true },
        spans: [{ ...segment.spans[0], style: { italic: true } }],
        cells: [
          [
            {
              text: segment.text,
              box: segment.box,
              header_axis: null,
              style: { align: 'right' },
              spans: [{ ...segment.spans[0], style: { color: '#AA00BB' } }],
            },
          ],
        ],
      },
    ],
  };
  const original = JSON.stringify(raw);
  const expected = structuredClone(raw);
  Object.assign(expected.segments[0].style, { id: 'observed' });
  Object.assign(expected.segments[0].spans[0].style, { id: 'observed' });
  Object.assign(expected.segments[0].cells[0][0].style, { id: 'observed' });
  Object.assign(expected.segments[0].cells[0][0].spans[0].style, {
    color: '#aa00bb',
    id: 'observed',
  });
  expect(parse(raw)).toEqual(expected);
  expect(JSON.stringify(raw)).toBe(original);
});
it('preserves explicit IDs, duplicate inline IDs, null styles and observed values', () => {
  const raw = styled({ id: 'emphasis', bold: false, family: null });
  expect(parse(raw)).toEqual(raw);
  expect(parse(authoredResponse)).toEqual(authoredResponse);
});
it.each([null, '', 7, false, 'invalid id'])(
  'rejects an explicit invalid ID %p',
  (id) => {
    expect(() => parse(styled({ id, italic: true }))).toThrow('INVALID_RESULT');
  },
);
it.each([
  { italic: 'true' },
  { relative_size: 99 },
  { color: '#GG0011' },
  { unknown: true },
  'italic',
  [],
])('does not repair malformed or unknown style observations %p', (style) => {
  expect(() => parse(styled(style))).toThrow('INVALID_RESULT');
});
it.each(['id', 'kind', 'page'])(
  'never supplies missing segment %s',
  (field) => {
    const raw = styled({ italic: true });
    delete (raw.segments[0] as Record<string, unknown>)[field];
    expect(() => parse(raw)).toThrow('INVALID_RESULT');
  },
);
