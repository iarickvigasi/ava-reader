import { overflowParent, overflowOriginal } from './overflow-context-fixture';
import { overflowRecognitionCandidate } from './overflow-recognition-candidate';
import { recognitionDecodedOutput } from './recognition-decoded-output';
import { recognitionAttemptResult } from './recognition-attempt-result';

it.each([0xd800, 0xdc00])(
  'rejects literal and escaped unpaired surrogate %i before UTF-8 replacement',
  (code) => {
    const raw = structuredClone(overflowOriginal);
    const scalar = String.fromCharCode(code),
      escape = '\\u' + code.toString(16);
    raw.segments[0].text += scalar;
    const escaped = JSON.stringify(raw),
      literal = escaped.replaceAll(escape, scalar);
    expect(literal).not.toBe(escaped);
    for (const output of [escaped, literal])
      expect(() =>
        overflowRecognitionCandidate(overflowParent, output),
      ).toThrow();
    const packet = recognitionDecodedOutput(
      overflowParent,
      JSON.stringify(overflowOriginal),
    );
    const malformed = packet.replace(
      'original_response_json',
      'original_response_json' + scalar,
    );
    expect(() =>
      recognitionAttemptResult(overflowParent, malformed, true),
    ).toThrow();
  },
);
