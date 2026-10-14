import { recognitionResponse } from './recognition-response';
import {
  authoredTask,
  authoredResponse,
} from './recognition-json-authored-fixture';
it('accepts the complete authored observation without changing source text or anchors', () => {
  const raw = structuredClone(authoredResponse),
    bytes = JSON.stringify(raw);
  expect(recognitionResponse(authoredTask, bytes)).toEqual(raw);
  expect(JSON.stringify(raw)).toBe(bytes);
});
it.each(['missing-kind', 'null-alt'])(
  'rejects %s without filling required observations',
  (change) => {
    const raw = structuredClone(authoredResponse);
    const segment = raw.segments[0] as Record<string, unknown>;
    if (change === 'missing-kind') delete segment.kind;
    else segment.alt = null;
    const bytes = JSON.stringify(raw);
    expect(() => recognitionResponse(authoredTask, bytes)).toThrow(
      'INVALID_RESULT',
    );
    expect(JSON.stringify(raw)).toBe(bytes);
  },
);
it('retains exact anchor context for the independent worker semantic check', () => {
  const raw = structuredClone(authoredResponse);
  raw.segments[0].spans[0].anchor.after = ' Second line.';
  const bytes = JSON.stringify(raw);
  // JSON Schema cannot compare quotations with prose; the pinned worker owns that check.
  expect(recognitionResponse(authoredTask, bytes)).toEqual(raw);
  expect(JSON.stringify(raw)).toBe(bytes);
});
