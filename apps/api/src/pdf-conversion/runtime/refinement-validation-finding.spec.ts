import { measurementPacket } from '../../library/pdf-import/reports/worker-measurements-fixture';
import {
  parseWorkerObservation,
  workerObservationPacket,
  WORKER_OBSERVATION_PREFIX,
} from './worker-observation';

function packet() {
  return {
    ...structuredClone(measurementPacket),
    command: 'validate_refinement',
    reuse: {
      ...measurementPacket.reuse,
      source_preparation: 'none',
      scope: 'worker_process_local_decode_and_annotation_memo',
    },
    failure_code: 'RECONSTRUCTION_REVIEW_REQUIRED',
    findings_complete: true,
    findings: [
      {
        kind: 'refinement',
        code: 'REFINEMENT_ROLE_BASELINE_INVALID',
        stage: 'refinement',
        check: 'body_reference_size_baseline',
        task_id_sha256: '1'.repeat(64),
        node_id_sha256: '2'.repeat(64),
        observation_sha256: '3'.repeat(64),
        render_sha256: '4'.repeat(64),
        page: 43,
      },
    ],
  };
}
it('retains finite known semantic failure provenance with the unchanged generic refusal', () => {
  const value = packet();
  expect(workerObservationPacket.parse(value)).toEqual(value);
  expect(
    parseWorkerObservation(
      WORKER_OBSERVATION_PREFIX + JSON.stringify(value) + '\n',
      value.binding,
      { command: 'validate_refinement', page_number: null },
    ),
  ).toEqual({ status: 'OBSERVED', packet: value });
});
it('rejects unknown checks, private fields, bad locations and unrelated outcome/command/binding', () => {
  const value = packet();
  for (const patch of [
    { check: 'PRIVATE_BOOK' },
    { text: 'PRIVATE_BOOK sk-secret' },
    { relative_size: 0.95 },
    { node_id_sha256: 'private-source-id' },
    { page: 0 },
    { page: 501 },
    { stage: 'extraction' },
  ])
    expect(
      workerObservationPacket.safeParse({
        ...value,
        findings: [{ ...value.findings[0], ...patch }],
      }).success,
    ).toBe(false);
  for (const patch of [
    { command: 'prepare' },
    { outcome: 'completed', failure_code: null },
    { findings_complete: false },
    { failure_code: 'ESSENTIAL_STRUCTURE_UNSUPPORTED' },
    { findings: [value.findings[0], value.findings[0]] },
  ])
    expect(
      workerObservationPacket.safeParse({ ...value, ...patch }).success,
    ).toBe(false);
  expect(
    parseWorkerObservation(
      WORKER_OBSERVATION_PREFIX + JSON.stringify(value) + '\n',
      { ...value.binding, source_sha256: 'f'.repeat(64) },
      { command: 'validate_refinement', page_number: null },
    ),
  ).toEqual({ status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' });
  expect(workerObservationPacket.parse(measurementPacket)).toEqual(
    measurementPacket,
  );
});
