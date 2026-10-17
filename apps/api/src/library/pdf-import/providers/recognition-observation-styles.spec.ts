import Ajv from 'ajv';
import { recognitionObservationSchema } from './recognition-observation-contract';
import { recognitionObservationDecoder } from './recognition-observation-output';
import {
  observationTask,
  observationResponse,
} from './recognition-observation-fixture';
const check = new Ajv({ strict: false }).compile(
  recognitionObservationSchema(),
);
const decode = recognitionObservationDecoder(observationTask);
const packet = (style: unknown) => {
  const raw = structuredClone(observationResponse);
  raw.segments[0].style = style;
  return raw;
};
it.each(['serif', 'sans-serif', 'monospace'])(
  'preserves %s and every non-alias value through the versioned wire',
  (family) => {
    const style = {
      font_family_role: family,
      block_indent_em: 1,
      indent_em: 0,
      italic: false,
      bold: true,
      color: '#aabbcc',
    };
    const raw = packet(style),
      before = JSON.stringify(raw);
    expect(check(raw)).toBe(true);
    const projected = { ...style, family } as Record<string, unknown>;
    delete projected.font_family_role;
    expect(decode(before)).toBe(decode(JSON.stringify(packet(projected))));
    expect(JSON.stringify(raw)).toBe(before);
    const decoded = JSON.parse(decode(before)) as {
      segments: { style: unknown }[];
    };
    expect(decoded.segments[0].style).toEqual({
      ...projected,
      id: 'observed',
    });
  },
);
it('projects inline styles without changing text, anchors or inline position', () => {
  const raw = structuredClone(observationResponse);
  raw.segments[0].spans = [
    {
      ...(raw.segments[0].spans as Record<string, unknown>[])[0],
      style: {
        font_family_role: 'serif',
        vertical_align: 'super',
        relative_size: 0.75,
      },
    },
  ];
  const canonical = structuredClone(raw);
  (canonical.segments[0].spans as Record<string, unknown>[])[0].style = {
    family: 'serif',
    vertical_align: 'super',
    relative_size: 0.75,
  };
  expect(check(raw)).toBe(true);
  expect(JSON.parse(decode(JSON.stringify(raw)))).toEqual(
    JSON.parse(decode(JSON.stringify(canonical))),
  );
});
it.each([
  { font_family_role: 'cursive' },
  { font_family_role: null },
  { font_family_role: 1 },
  { font_family_role: {} },
  { font_family_role: 'serif', family: 'serif' },
  { font_family_role: 'serif', family: 'sans-serif' },
  { font_family_role: 'serif', family: null },
  { font_family_role: 'serif', id: 'model-owned' },
  { font_family_role: 'serif', fontFamily: 'serif' },
  { font_family_role: 'serif', block_indent_em: 7 },
])('rejects ambiguous, malformed or unrelated style fields: %j', (style) => {
  const raw = packet(style);
  expect(check(raw)).toBe(false);
  expect(() => decode(JSON.stringify(raw))).toThrow();
});
it('does not reinterpret old receipts or aliases outside styles', () => {
  expect(() =>
    decode(
      JSON.stringify({
        ...packet({ font_family_role: 'serif' }),
        schema_version: 'ava-recognition-observation-1',
      }),
    ),
  ).toThrow('PDF_PROVIDER_OUTPUT_INVALID');
  const raw = structuredClone(observationResponse);
  raw.segments[0].font_family_role = 'serif';
  expect(check(raw)).toBe(false);
  expect(() => decode(JSON.stringify(raw))).toThrow('INVALID_RESULT');
});
