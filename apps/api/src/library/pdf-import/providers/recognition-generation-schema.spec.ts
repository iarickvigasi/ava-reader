import * as contract from './recognition-observation-contract';
import Ajv from 'ajv';
import { recognitionGenerationSchema } from './recognition-generation-schema';
import { recognitionObservationSchema } from './recognition-observation-contract';
import { recognitionObservationDecoder } from './recognition-observation-output';
import {
  observationResponse,
  observationTask,
} from './recognition-observation-fixture';
const schema = recognitionGenerationSchema();
const check = new Ajv({ strict: false, allowUnionTypes: true }).compile(schema);
const decode = recognitionObservationDecoder(observationTask);
const packet = (style: unknown) => {
  const result = structuredClone(observationResponse);
  result.segments[0].style = style;
  result.segments[0].chapter_start = false;
  return result;
};
it('preserves sparse observed values, explicit resets and canonical decoding', () => {
  for (const style of [
    null,
    {},
    { relative_size: 0.8, bold: false, indent_em: 0 },
    { family: 'serif', italic: true, vertical_align: 'super' },
  ]) {
    const raw = packet(style),
      before = JSON.stringify(raw);
    expect(check(raw)).toBe(true);
    expect(() => decode(before)).not.toThrow();
    expect(JSON.stringify(raw)).toBe(before);
  }
});
it.each([
  { size: 0.8 },
  { font_size: 12 },
  { relative_size: 1, size: 1 },
  { relative_size: 9 },
  { bold: 'false' },
  { id: 'invented' },
])(
  'rejects invented or invalid style values during generation and at the host: %j',
  (style) => {
    const raw = packet(style);
    expect(check(raw)).toBe(false);
    expect(() => decode(JSON.stringify(raw))).toThrow();
  },
);
it('closes nested span styles and source anchors as well as segment styles', () => {
  const raw = packet({ relative_size: 1 });
  const spans = raw.segments[0].spans as Record<string, unknown>[];
  spans[0].style = { size: 0.8 };
  expect(check(raw)).toBe(false);
  spans[0].style = { relative_size: 0.8 };
  expect(check(raw)).toBe(true);
  spans[0].anchor = { ...(spans[0].anchor as object), invented: 'field' };
  expect(check(raw)).toBe(false);
});
it('retains the stronger host kind contract instead of treating grammar as acceptance', () => {
  const raw = packet(null);
  raw.segments[0].kind = 'figure';
  raw.segments[0].spans = [];
  delete raw.segments[0].alt;
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).toThrow();
});
it('has no conditional/discriminated expansion and preserves canonical schema bytes', () => {
  const original = JSON.stringify(recognitionObservationSchema());
  const encoded = JSON.stringify(recognitionGenerationSchema());
  expect(encoded).not.toMatch(
    /"(?:allOf|anyOf|oneOf|if|then|else|not|\$ref|\$defs)":/,
  );
  expect(encoded).not.toContain('font_family_role');
  expect(encoded.length).toBeLessThan(14000);
  expect(JSON.stringify(recognitionObservationSchema())).toBe(original);
  expect(JSON.stringify(recognitionGenerationSchema())).toBe(encoded);
});

it.each(['oneOf', 'if', 'then', 'else', 'discriminator'])(
  'refuses unknown structural schema changes: %s',
  (keyword) => {
    const changed = recognitionObservationSchema();
    changed[keyword] = {};
    const mock = jest
      .spyOn(contract, 'recognitionObservationSchema')
      .mockReturnValue(changed);
    try {
      expect(() => recognitionGenerationSchema()).toThrow(
        'PDF_PROVIDER_REQUEST_INVALID',
      );
    } finally {
      mock.mockRestore();
    }
  },
);
it('refuses extra conditional segment branches instead of dropping new semantics', () => {
  const changed = recognitionObservationSchema();
  const defs = changed.$defs as Record<string, { allOf: object[] }>;
  defs.RecognitionSegment.allOf.push({ if: {}, then: {} });
  const mock = jest
    .spyOn(contract, 'recognitionObservationSchema')
    .mockReturnValue(changed);
  try {
    expect(() => recognitionGenerationSchema()).toThrow(
      'PDF_PROVIDER_REQUEST_INVALID',
    );
  } finally {
    mock.mockRestore();
  }
});

it('validates table cells and inline styles without allowing unknown keys at any level', () => {
  const raw = packet({ relative_size: 1 });
  const segment = raw.segments[0];
  segment.kind = 'table';
  segment.text = '';
  segment.spans = [];
  const span = {
    anchor: { exact_text: 'alpha' },
    style: { family: null, bold: false },
    note_label: null,
    target_text: null,
    url: null,
  };
  const cell = {
    text: 'alpha',
    box: segment.box,
    style: { relative_size: 0.8, italic: false },
    spans: [span],
    header_axis: null,
    row_span: 1,
    column_span: 1,
    source_cell_id: null,
  };
  segment.cells = [[cell]];
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).not.toThrow();
  for (const target of [segment.style, cell.style, span.style]) {
    const style = target as Record<string, unknown>;
    for (const key of ['size', 'invented']) {
      style[key] = 0.8;
      expect(check(raw)).toBe(false);
      expect(() => decode(JSON.stringify(raw))).toThrow();
      delete style[key];
    }
  }
  expect(check(raw)).toBe(true);
});

it('refuses unknown unions inside the unwrapped segment base', () => {
  const changed = recognitionObservationSchema();
  const defs = changed.$defs as Record<
    string,
    { allOf: Record<string, unknown>[] }
  >;
  defs.RecognitionSegment.allOf[0].oneOf = [{ type: 'object' }];
  const mock = jest
    .spyOn(contract, 'recognitionObservationSchema')
    .mockReturnValue(changed);
  try {
    expect(() => recognitionGenerationSchema()).toThrow(
      'PDF_PROVIDER_REQUEST_INVALID',
    );
  } finally {
    mock.mockRestore();
  }
});

it('keeps array resource limits at the host even when generation omits them', () => {
  expect(JSON.stringify(recognitionGenerationSchema())).not.toContain(
    '"maxItems":',
  );
  expect(JSON.stringify(recognitionObservationSchema())).toContain(
    '"maxItems":',
  );
  const raw = {
    ...packet(null),
    unresolved: Array.from({ length: 101 }, () => 'unresolved'),
  };
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).toThrow();
});

it('requires an explicit chapter decision without guessing it in the decoder', () => {
  const raw = packet(null);
  const segment = raw.segments[0];
  segment.kind = 'heading';
  segment.heading_level = 3;
  delete segment.chapter_start;
  expect(check(raw)).toBe(false);
  expect(() => decode(JSON.stringify(raw))).toThrow();
  segment.chapter_start = false;
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).not.toThrow();
  segment.chapter_start = true;
  expect(() => decode(JSON.stringify(raw))).toThrow();
  segment.kind = 'paragraph';
  delete segment.heading_level;
  segment.chapter_start = false;
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).not.toThrow();
});

it.each(['frontmatter', 'bodymatter', 'backmatter'])(
  'requires a model-supplied chapter role and preserves the observed %s decision',
  (role) => {
    const raw = packet(null);
    const segment = raw.segments[0];
    segment.kind = 'heading';
    segment.heading_level = 1;
    segment.chapter_start = true;
    delete segment.chapter_role;
    expect(check(raw)).toBe(false);
    expect(() => decode(JSON.stringify(raw))).toThrow('INVALID_RESULT');
    segment.chapter_role = role;
    expect(check(raw)).toBe(true);
    const canonical = JSON.parse(decode(JSON.stringify(raw))) as {
      segments: { chapter_start: boolean; chapter_role: string }[];
    };
    expect(canonical.segments[0]).toMatchObject({
      chapter_start: true,
      chapter_role: role,
    });
  },
);
it('requires explicit null when a role is inapplicable but never accepts a null chapter role', () => {
  const raw = packet(null);
  delete raw.segments[0].chapter_role;
  expect(check(raw)).toBe(false);
  raw.segments[0].chapter_role = null;
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).not.toThrow();
  Object.assign(raw.segments[0], {
    kind: 'heading',
    heading_level: 1,
    chapter_start: true,
  });
  expect(check(raw)).toBe(true);
  expect(() => decode(JSON.stringify(raw))).toThrow('INVALID_RESULT');
});
