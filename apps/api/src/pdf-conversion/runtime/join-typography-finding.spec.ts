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
        kind: 'refinement',
        code: 'JOIN_TYPOGRAPHY_CONFLICT',
        stage: 'refinement',
        task_id_sha256: '1'.repeat(64),
        edge_id_sha256: '2'.repeat(64),
        previous_id_sha256: '3'.repeat(64),
        next_id_sha256: '4'.repeat(64),
        observation_sha256: '5'.repeat(64),
        render_sha256: '6'.repeat(64),
        previous_page: 43,
        next_page: 44,
        conflicting_fields: ['italic', 'line_height'],
      },
    ],
  };
}
it('retains a bound text-free conflict with the unchanged public refusal and exact provenance', () => {
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
    { style: { line_height: 1.25 } },
    { previous_id_sha256: 'private-source-path' },
    { previous_page: 0 },
    { next_page: 501 },
    { stage: 'extraction' },
    { conflicting_fields: [] },
    { conflicting_fields: ['italic', 'italic'] },
    { conflicting_fields: ['line_height', 'italic'] },
    { conflicting_fields: ['PRIVATE_BOOK'] },
  ])
    expect(
      workerObservationPacket.safeParse({
        ...value,
        findings: [{ ...base, ...patch }],
      }).success,
    ).toBe(false);
});
it('never presents conflicts as success, unrelated admission failures or complete mixed diagnostics', () => {
  const value = packet();
  for (const patch of [
    { command: 'prepare' },
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
