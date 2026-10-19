import { recognitionObservationDecoder } from './recognition-observation-output';
import {
  observationTask,
  observationResponse,
} from './recognition-observation-fixture';
const decode = recognitionObservationDecoder(observationTask);
function encoded(text: string) {
  const raw = structuredClone(observationResponse);
  raw.segments[0].text = text;
  raw.segments[0].spans = [];
  return JSON.stringify(raw);
}
it.each(['\ud800', '\udfff'])(
  'rejects a literal lone surrogate before UTF-8 encoding',
  (scalar) => {
    const json = encoded('A' + scalar + 'B');
    const escaped = JSON.stringify(scalar).slice(1, -1);
    expect(() => decode(json.replace(escaped, scalar))).toThrow(
      'PDF_PROVIDER_OUTPUT_INVALID',
    );
  },
);
it.each(['A😀B', 'e\u0301', '👩‍💻', '\ufffd'])(
  'preserves valid Unicode scalars exactly: %s',
  (text) => {
    const raw = JSON.parse(decode(encoded(text))) as {
      segments: { text: string }[];
    };
    expect(raw.segments[0].text).toBe(text);
  },
);
it('preserves an escaped surrogate for unchanged downstream scalar validation', () => {
  const output = decode(encoded('A\ud800B'));
  expect(output).toContain('\\ud800');
  expect(output).not.toContain('\ufffd');
});
