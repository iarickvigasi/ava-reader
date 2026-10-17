import { workerObservationPacket } from '../../../pdf-conversion/runtime/worker-observation';
// Content-free authored identities with the shape/counts of the retained failed attempt.
export const measurementPacket = workerObservationPacket.parse({
  reuse: {
    scope:
      'worker_attempt_private_checkpoints_and_process_local_decode_and_annotation_memo',
    annotation_view: {
      hits: 3,
      misses: 1,
    },
    checkpoint_decode: {
      hits: 386,
      misses: 138,
    },
    source_preparation: 'attempt_private_page_checkpoints',
  },
  method: 'PYTHON_MONOTONIC',
  phases: [
    {
      name: 'prepare_source',
      outcome: 'completed',
      work_ms: 4748,
      ended_ms: 4755,
      started_ms: 7,
    },
    {
      name: 'prepare_refinement',
      outcome: 'completed',
      work_ms: 6550,
      ended_ms: 110482,
      started_ms: 103932,
    },
    {
      name: 'reconstruct',
      outcome: 'failed',
      work_ms: 3517,
      ended_ms: 165759,
      started_ms: 162242,
    },
    {
      name: 'prepare_refinement',
      outcome: 'completed',
      work_ms: 1536,
      ended_ms: 165755,
      started_ms: 164219,
    },
  ],
  binding: {
    job_id: 'job-measured',
    unit_id: 'unit-measured',
    attempt_id: 'attempt-measured',
    generation: 1,
    profile_id: 'ava-pdf-prose-en-uk-v3',
    operation_id: 'pdf-measured',
    attempt_fence: 1,
    config_sha256:
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    source_sha256:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    request_sha256:
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    cancellation_epoch: 0,
    worker_fingerprint:
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  },
  command: 'attempt_stream',
  outcome: 'failed',
  work_ms: 165759,
  ended_at: '2026-10-12T16:36:03.779Z',
  findings: [],
  inventory: {
    flags: [
      {
        code: 'conditional_visibility',
        pages: 4,
      },
      {
        code: 'nonstandard_text_rendering',
        pages: 4,
      },
    ],
    coverage: 'full',
    locations: [
      {
        code: 'conditional_visibility',
        page: 1,
      },
      {
        code: 'conditional_visibility',
        page: 2,
      },
      {
        code: 'conditional_visibility',
        page: 3,
      },
      {
        code: 'conditional_visibility',
        page: 4,
      },
      {
        code: 'nonstandard_text_rendering',
        page: 1,
      },
      {
        code: 'nonstandard_text_rendering',
        page: 2,
      },
      {
        code: 'nonstandard_text_rendering',
        page: 3,
      },
      {
        code: 'nonstandard_text_rendering',
        page: 4,
      },
    ],
    route_pages: {
      blank: 0,
      hybrid: 0,
      native: 0,
      unknown: 0,
      recognition: 4,
    },
    layout_pages: {
      unknown: 4,
      two_column: 0,
      single_column: 0,
      review_required: 0,
    },
    layout_method: 'qualified_native_reading_order_or_review',
    language_pages: {
      en: 4,
      uk: 0,
      unknown: 0,
    },
    observed_pages: 4,
    prepared_pages: 4,
    language_method: 'bounded_native_page_script_and_hint_heuristic',
    annotation_scope: 'original_top_level_objects_classified',
    annotation_counts: {
      link: 4,
      empty: 0,
      visible: 0,
      personal: 0,
    },
    source_page_count: 4,
    locations_complete: true,
    observed_profile_id: 'ava-pdf-prose-en-uk-v3',
    source_bytes_verified: true,
    language_character_limit: 65536,
  },
  resources: {
    cpu_method: 'rusage_delta_self_and_reaped_children',
    cpu_self_ms: 13507,
    scratch_scan: 'complete',
    peak_rss_bytes: 152498176,
    peak_rss_scope: 'worker_process',
    peak_rss_method: 'rusage_lifetime_max_not_delta',
    peak_rss_platform: 'linux_kib',
    scratch_bytes_method: 'logical_regular_file_sizes_at_command_end',
    scratch_current_bytes: 3027598,
    cpu_finished_children_ms: 1931,
  },
  started_at: '2026-10-12T16:33:18.021Z',
  work_scope:
    'main_command_excludes_interpreter_startup_and_observation_export',
  page_number: null,
  failure_code: 'RECONSTRUCTION_REVIEW_REQUIRED',
  phase_timing: 'inclusive_nested_not_summable',
  schema_version: 'ava-worker-observation-1',
  findings_complete: true,
  request_binding_scope: 'reconstruction_request_json_bytes',
});
