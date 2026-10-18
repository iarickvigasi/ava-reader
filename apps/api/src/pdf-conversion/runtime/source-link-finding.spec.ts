import { measurementPacket } from '../../library/pdf-import/reports/worker-measurements-fixture';
import {
  parseWorkerObservation,
  workerObservationPacket,
  WORKER_OBSERVATION_PREFIX,
} from './worker-observation';

function packet() {
  return {
    ...structuredClone(measurementPacket),
    failure_code: 'RECONSTRUCTION_REVIEW_REQUIRED',
    findings_complete: true,
    findings: [
      {
        kind: 'source_link',
        code: 'PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW',
        link_step: 'caller',
        page: 231,
        annotation_number: 28,
        observation_sha256: '5'.repeat(64),
        render_sha256: '6'.repeat(64),
      },
    ],
  };
}
it('retains a bound text-free source-link failure with the unchanged public refusal and exact provenance', () => {
  const value = packet();
  expect(workerObservationPacket.parse(value)).toEqual(value);
  const stderr = WORKER_OBSERVATION_PREFIX + JSON.stringify(value) + '\n';
  expect(
    parseWorkerObservation(stderr, value.binding, {
      command: value.command,
      page_number: value.page_number,
    }),
  ).toEqual({ status: 'OBSERVED', packet: value });
  expect(
    parseWorkerObservation(
      stderr,
      { ...value.binding, source_sha256: 'f'.repeat(64) },
      { command: value.command, page_number: value.page_number },
    ),
  ).toEqual({ status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' });
});
it('rejects invented fields, raw values, malformed identities and duplicate or unknown field names', () => {
  const value = packet(),
    base = value.findings[0];
  for (const patch of [
    { text: 'PRIVATE_BOOK sk-secret' },
    { url: 'https://private.example' },
    { observation_sha256: 'private-source-path' },
    { page: 0 },
    { page: 501 },
    { annotation_number: 0 },
    { annotation_number: 1001 },
    { link_step: 'extraction' },
    { code: 'PRIVATE_BOOK' },
  ])
    expect(
      workerObservationPacket.safeParse({
        ...value,
        findings: [{ ...base, ...patch }],
      }).success,
    ).toBe(false);
});
it('never presents source-link failures as success, unrelated admission failures or complete mixed diagnostics', () => {
  const value = packet();
  for (const patch of [
    { command: 'prepare' },
    { command: 'validate_refinement' },
    { outcome: 'completed', failure_code: null },
    { failure_code: 'HEADING_PARENT_MISSING' },
    { findings_complete: false },
    { findings: [value.findings[0], value.findings[0]] },
  ])
    expect(
      workerObservationPacket.safeParse({ ...value, ...patch }).success,
    ).toBe(false);
  expect(workerObservationPacket.parse(measurementPacket)).toEqual(
    measurementPacket,
  );
});
