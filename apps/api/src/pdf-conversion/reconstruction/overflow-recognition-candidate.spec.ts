import { overflowParent, overflowOriginal } from './overflow-context-fixture';
import { overflowRecognitionCandidate } from './overflow-recognition-candidate';
import { recognitionDecodedOutput } from './recognition-decoded-output';
import { recognitionAttemptResult } from './recognition-attempt-result';
import { recognitionResponse } from './recognition-response';

it('keeps the raw invalid context behind an explicit packet and current-attempt gate', () => {
  const raw = JSON.stringify(overflowOriginal);
  const decoded = recognitionDecodedOutput(overflowParent, raw);
  expect(
    (JSON.parse(decoded) as { schema_version: string }).schema_version,
  ).toBe('ava-recognition-overflow-candidate-1');
  expect(() => recognitionResponse(overflowParent, decoded)).toThrow();
  expect(() =>
    recognitionAttemptResult(overflowParent, decoded, false),
  ).toThrow();
  const candidate = recognitionAttemptResult(overflowParent, decoded, true);
  expect(candidate.response).toEqual(overflowOriginal);
  expect(JSON.parse(candidate.originalResponseJson)).toEqual(overflowOriginal);
  expect(() =>
    recognitionResponse(overflowParent, JSON.stringify(candidate.response)),
  ).toThrow();
});

it.each([
  { url: 'https://example.com' },
  { note_label: '1' },
  { target_text: 'Alpha' },
  { start: 0, end: 1 },
  { style: null },
  { style: { id: 'bad', invented: true } },
])('does not mask other faults or references: %j', (patch) => {
  const raw = structuredClone(overflowOriginal);
  Object.assign(raw.segments[0].spans[0], patch);
  expect(() =>
    overflowRecognitionCandidate(overflowParent, JSON.stringify(raw)),
  ).toThrow();
});

it('retains duplicate-key, Unicode, upper bound and source fences', () => {
  const raw = JSON.stringify(overflowOriginal);
  expect(() =>
    overflowRecognitionCandidate(
      overflowParent,
      raw.replace('"language":"en"', '"language":"en","language":"en"'),
    ),
  ).toThrow();
  for (const value of ['x'.repeat(4097), '\ud800', '\u0000']) {
    const changed = structuredClone(overflowOriginal);
    changed.segments[0].spans[0].anchor!.before = value;
    expect(() =>
      overflowRecognitionCandidate(overflowParent, JSON.stringify(changed)),
    ).toThrow();
  }
  const changed = structuredClone(overflowOriginal);
  changed.source_sha256 = 'b'.repeat(64);
  expect(() =>
    recognitionDecodedOutput(overflowParent, JSON.stringify(changed)),
  ).toThrow();
});
