import {
  parseWorkerObservation,
  workerObservationPacket,
  WORKER_OBSERVATION_PREFIX,
} from './worker-observation';

function packet() {
  return workerObservationPacket.parse({
    schema_version: 'ava-worker-observation-1',
    binding: {
      operation_id: 'pdf-fixture',
      job_id: 'job-fixture',
      attempt_id: 'attempt-fixture',
      unit_id: 'unit-fixture',
      source_sha256: 'a'.repeat(64),
      profile_id: 'ava-pdf-prose-en-v2',
      config_sha256: 'b'.repeat(64),
      worker_fingerprint: 'c'.repeat(64),
      generation: 1,
      attempt_fence: 2,
      cancellation_epoch: 0,
      request_sha256: 'd'.repeat(64),
    },
    command: 'validate_tasks',
    page_number: null,
    outcome: 'completed',
    failure_code: null,
    started_at: '2026-10-09T10:00:00.000Z',
    ended_at: '2026-10-09T10:00:00.025Z',
    method: 'PYTHON_MONOTONIC',
    work_scope:
      'main_command_excludes_interpreter_startup_and_observation_export',
    request_binding_scope: 'reconstruction_request_json_bytes',
    phase_timing: 'inclusive_nested_not_summable',
    work_ms: 25,
    phases: [],
    resources: {
      cpu_self_ms: null,
      cpu_finished_children_ms: null,
      cpu_method: 'rusage_delta_self_and_reaped_children',
      peak_rss_bytes: null,
      peak_rss_scope: 'worker_process',
      peak_rss_method: 'rusage_lifetime_max_not_delta',
      peak_rss_platform: 'unknown',
      scratch_current_bytes: null,
      scratch_scan: 'unavailable',
      scratch_bytes_method: 'logical_regular_file_sizes_at_command_end',
    },
    inventory: {
      coverage: 'unknown',
      source_bytes_verified: false,
      observed_profile_id: null,
      source_page_count: null,
      observed_pages: 0,
      prepared_pages: 0,
      language_pages: { en: 0, uk: 0, unknown: 0 },
      layout_pages: {
        single_column: 0,
        two_column: 0,
        review_required: 0,
        unknown: 0,
      },
      route_pages: {
        native: 0,
        recognition: 0,
        hybrid: 0,
        blank: 0,
        unknown: 0,
      },
      annotation_counts: { link: 0, empty: 0, personal: 0, visible: 0 },
      flags: [],
      locations: [],
      locations_complete: true,
      language_method: 'bounded_native_page_script_and_hint_heuristic',
      language_character_limit: 65536,
      layout_method: 'qualified_native_reading_order_or_review',
      annotation_scope: 'original_top_level_objects_classified',
    },
    reuse: {
      source_preparation: 'none',
      scope: 'worker_process_local_decode_and_annotation_memo',
      checkpoint_decode: { hits: 0, misses: 0 },
      annotation_view: { hits: 0, misses: 0 },
    },
    findings: [],
    findings_complete: true,
  });
}
const line = (value: unknown) =>
  WORKER_OBSERVATION_PREFIX + JSON.stringify(value) + '\n';
it('admits truthful attempt-local reuse without changing or widening standalone packets', () => {
  const value = packet();
  const attempt = {
    ...value,
    command: 'attempt_stream',
    reuse: {
      ...value.reuse,
      scope:
        'worker_attempt_private_checkpoints_and_process_local_decode_and_annotation_memo',
      source_preparation: 'attempt_private_page_checkpoints',
    },
  };
  expect(workerObservationPacket.safeParse(attempt).success).toBe(true);
  expect(
    workerObservationPacket.safeParse({
      ...attempt,
      reuse: { ...attempt.reuse, source_preparation: 'none' },
    }).success,
  ).toBe(true);
  expect(
    workerObservationPacket.safeParse({ ...value, reuse: attempt.reuse })
      .success,
  ).toBe(false);
  expect(
    workerObservationPacket.safeParse({ ...attempt, reuse: value.reuse })
      .success,
  ).toBe(false);
  expect(workerObservationPacket.parse(value)).toEqual(value);
});
it('accepts a bound validation-only packet without claiming verified source/profile or resources', () => {
  const value = packet();
  expect(
    parseWorkerObservation(line(value), value.binding, {
      command: 'validate_tasks',
      page_number: null,
    }),
  ).toEqual({ status: 'OBSERVED', packet: value });
});
it('rejects wrong source/fence/request/unit and expected command/page', () => {
  const value = packet(),
    unit = { command: 'validate_tasks' as const, page_number: null };
  for (const changed of [
    { source_sha256: 'e'.repeat(64) },
    { attempt_fence: 9 },
    { request_sha256: 'e'.repeat(64) },
    { unit_id: 'unit-other' },
  ])
    expect(
      parseWorkerObservation(
        line({ ...value, binding: { ...value.binding, ...changed } }),
        value.binding,
        unit,
      ),
    ).toEqual({ status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' });
  expect(
    parseWorkerObservation(line(value), value.binding, {
      command: 'prepare',
      page_number: 1,
    }),
  ).toEqual({ status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' });
});
it('missing/malformed/oversized/duplicate packets and private fields remain explicitly unobserved', () => {
  const value = packet(),
    unit = { command: 'validate_tasks' as const, page_number: null };
  expect(parseWorkerObservation(undefined, value.binding, unit)).toEqual({
    status: 'UNOBSERVED',
    reason: 'NOT_EMITTED',
  });
  for (const invalid of [
    WORKER_OBSERVATION_PREFIX + '{private}',
    line(value) + line(value),
    line({ ...value, prompt: 'private prompt bearer sk-secret' }),
    WORKER_OBSERVATION_PREFIX + 'x'.repeat(6144),
  ])
    expect(parseWorkerObservation(invalid, value.binding, unit)).toEqual({
      status: 'UNOBSERVED',
      reason: 'MALFORMED',
    });
});
it('cannot promote an incomplete source, contradictory counts or partial resource scan to measured coverage', () => {
  const value = packet();
  for (const invalid of [
    { ...value, inventory: { ...value.inventory, coverage: 'full' } },
    { ...value, inventory: { ...value.inventory, prepared_pages: 1 } },
    { ...value, resources: { ...value.resources, scratch_current_bytes: 100 } },
    { ...value, resources: { ...value.resources, peak_rss_bytes: 100 } },
    {
      ...value,
      phases: [
        {
          name: 'reconstruct',
          started_ms: 0,
          ended_ms: 26,
          work_ms: 26,
          outcome: 'completed',
        },
      ],
    },
  ])
    expect(workerObservationPacket.safeParse(invalid).success).toBe(false);
});
it('retains bounded source coordinates and refuses a finding outside its qualified source region', () => {
  const value = packet(),
    box = {
      coordinate_space: 'page_points_top_left',
      x0: 10,
      y0: 10,
      x1: 20,
      y1: 20,
    };
  const finding = {
    kind: 'source',
    severity: 'blocking',
    code: 'RECOGNITION_UNRESOLVED',
    page: 1,
    box,
    region_box: { ...box, x0: 0, y0: 0, x1: 30, y1: 30 },
    block_id: null,
    segment_id_sha256: null,
    task_id: 'task-fixture',
    render_sha256: null,
  };
  expect(
    workerObservationPacket.safeParse({
      ...value,
      outcome: 'failed',
      failure_code: 'RECOGNITION_UNRESOLVED',
      findings: [finding],
    }).success,
  ).toBe(true);
  expect(
    workerObservationPacket.safeParse({
      ...value,
      findings: [{ ...finding, box: { ...box, x1: 40 } }],
    }).success,
  ).toBe(false);
});
