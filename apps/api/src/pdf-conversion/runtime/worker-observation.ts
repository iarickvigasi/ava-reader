import { z } from 'zod';

export const WORKER_OBSERVATION_PREFIX = 'AVA_WORKER_OBSERVATION_V1 ';
export const WORKER_OBSERVATION_BYTES = 6144;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,119}$/);
const count = z.number().int().nonnegative().max(100_000_000);
const milliseconds = z.number().int().nonnegative().max(86_400_000);
const bytes = z
  .number()
  .int()
  .nonnegative()
  .max(8 * 1024 ** 3);
const page = z.number().int().min(1).max(500);
const box = z
  .object({
    coordinate_space: z.literal('page_points_top_left'),
    x0: z.number().finite().min(0).max(20000),
    y0: z.number().finite().min(0).max(20000),
    x1: z.number().finite().positive().max(20000),
    y1: z.number().finite().positive().max(20000),
  })
  .strict()
  .refine((value) => value.x0 < value.x1 && value.y0 < value.y1);
export const workerCommand = z.enum([
  'prepare',
  'prepare_refinement',
  'reconstruct',
  'reconstruct_stream',
  'attempt_stream',
  'validate_tasks',
  'validate_refinement',
]);
const sourceCode = z.enum([
  'ESSENTIAL_STRUCTURE_UNSUPPORTED',
  'RECOGNITION_UNRESOLVED',
  'SOURCE_LANGUAGE_UNSUPPORTED',
]);
const admissionCode = z.enum([
  'PDF_ACTIVE_CONTENT_UNSUPPORTED',
  'PDF_EMBEDDED_CONTENT_UNSUPPORTED',
  'PDF_FORMS_UNSUPPORTED',
  'PDF_ANNOTATION_INVALID',
  'PDF_RESOURCE_LIMIT',
  'PDF_REDACTION_UNSUPPORTED',
  'PDF_ANNOTATIONS_UNSUPPORTED',
  'PDF_ANNOTATION_GEOMETRY_INVALID',
  'PDF_ANNOTATION_APPEARANCE_REQUIRED',
  'PDF_ANNOTATION_APPEARANCE_INVALID',
  'PDF_ANNOTATION_VISIBILITY_REQUIRES_REVIEW',
]);
const failureCode = z.union([
  z.literal('RECONSTRUCTION_REVIEW_REQUIRED'),
  sourceCode,
  admissionCode,
]);
export const workerBinding = z
  .object({
    operation_id: id,
    job_id: id,
    attempt_id: id,
    unit_id: id,
    source_sha256: digest,
    profile_id: z.enum(['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3']),
    config_sha256: digest,
    worker_fingerprint: digest,
    generation: z.number().int().positive(),
    attempt_fence: z.number().int().positive(),
    cancellation_epoch: z.number().int().nonnegative(),
    request_sha256: digest,
  })
  .strict();
export const workerSourceFinding = z
  .object({
    kind: z.literal('source'),
    severity: z.literal('blocking'),
    code: sourceCode,
    page,
    box,
    region_box: box,
    block_id: id.nullable(),
    segment_id_sha256: digest.nullable(),
    task_id: id.nullable(),
    render_sha256: digest.nullable(),
  })
  .strict();
const admissionFinding = z
  .object({
    kind: z.literal('admission'),
    code: admissionCode,
    page: page.nullable(),
    annotation_number: z.number().int().min(1).max(1000).nullable(),
    relationship_path: z.array(z.enum(['/Popup', '/Parent', '/IRT'])).max(20),
  })
  .strict();
const riskCode = z.enum([
  'clipped_glyph',
  'unreliable_glyph_mapping',
  'glyph_without_visible_ink',
  'complex_graphics_state',
  'nonstandard_text_rendering',
  'conditional_visibility',
  'optional_content',
  'language_uncertain',
  'visible_annotation',
]);
const phase = z
  .object({
    name: z.enum([
      'prepare_source',
      'prepare_refinement',
      'reconstruct',
      'export',
    ]),
    started_ms: milliseconds,
    ended_ms: milliseconds,
    work_ms: milliseconds,
    outcome: z.enum(['completed', 'failed']),
  })
  .strict()
  .refine(
    (value) =>
      value.ended_ms >= value.started_ms &&
      value.work_ms === value.ended_ms - value.started_ms,
  );

// Only this fixed, content-free observation is allowed out of stderr. It does
// not grant source accuracy, execution authority, or publication readiness.
export const workerObservationPacket = z
  .object({
    schema_version: z.literal('ava-worker-observation-1'),
    binding: workerBinding,
    command: workerCommand,
    page_number: page.nullable(),
    outcome: z.enum(['completed', 'failed', 'aborted']),
    failure_code: failureCode.nullable(),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime(),
    method: z.literal('PYTHON_MONOTONIC'),
    phase_timing: z.literal('inclusive_nested_not_summable'),
    work_ms: milliseconds,
    work_scope: z.literal(
      'main_command_excludes_interpreter_startup_and_observation_export',
    ),
    request_binding_scope: z.literal('reconstruction_request_json_bytes'),
    phases: z.array(phase).max(8),
    resources: z
      .object({
        cpu_self_ms: milliseconds.nullable(),
        cpu_finished_children_ms: milliseconds.nullable(),
        cpu_method: z.literal('rusage_delta_self_and_reaped_children'),
        peak_rss_bytes: bytes.nullable(),
        peak_rss_scope: z.literal('worker_process'),
        peak_rss_method: z.literal('rusage_lifetime_max_not_delta'),
        peak_rss_platform: z.enum(['linux_kib', 'darwin_bytes', 'unknown']),
        scratch_current_bytes: bytes.nullable(),
        scratch_bytes_method: z.literal(
          'logical_regular_file_sizes_at_command_end',
        ),
        scratch_scan: z.enum([
          'complete',
          'entry_limit',
          'time_limit',
          'unsafe_entry',
          'unavailable',
        ]),
      })
      .strict(),
    inventory: z
      .object({
        coverage: z.enum(['full', 'partial', 'unknown']),
        source_bytes_verified: z.boolean(),
        observed_profile_id: z
          .enum(['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'])
          .nullable(),
        source_page_count: page.nullable(),
        observed_pages: z.number().int().nonnegative().max(500),
        prepared_pages: z.number().int().nonnegative().max(500),
        language_pages: z
          .object({ en: count, uk: count, unknown: count })
          .strict(),
        layout_pages: z
          .object({
            single_column: count,
            two_column: count,
            review_required: count,
            unknown: count,
          })
          .strict(),
        route_pages: z
          .object({
            native: count,
            recognition: count,
            hybrid: count,
            blank: count,
            unknown: count,
          })
          .strict(),
        annotation_counts: z
          .object({
            link: count,
            empty: count,
            personal: count,
            visible: count,
          })
          .strict(),
        flags: z
          .array(
            z
              .object({
                code: riskCode,
                pages: z.number().int().nonnegative().max(500),
              })
              .strict(),
          )
          .max(12),
        locations: z.array(z.object({ code: riskCode, page }).strict()).max(8),
        locations_complete: z.boolean(),
        language_method: z.literal(
          'bounded_native_page_script_and_hint_heuristic',
        ),
        language_character_limit: z.literal(65536),
        layout_method: z.literal('qualified_native_reading_order_or_review'),
        annotation_scope: z.literal('original_top_level_objects_classified'),
      })
      .strict(),
    reuse: z
      .object({
        source_preparation: z.enum([
          'none',
          'attempt_private_page_checkpoints',
        ]),
        scope: z.enum([
          'worker_process_local_decode_and_annotation_memo',
          'worker_attempt_private_checkpoints_and_process_local_decode_and_annotation_memo',
        ]),
        checkpoint_decode: z.object({ hits: count, misses: count }).strict(),
        annotation_view: z.object({ hits: count, misses: count }).strict(),
      })
      .strict(),
    findings: z
      .array(
        z.discriminatedUnion('kind', [workerSourceFinding, admissionFinding]),
      )
      .max(2),
    findings_complete: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const attempt = value.command === 'attempt_stream';
    if (
      (value.reuse.source_preparation !== 'none' && !attempt) ||
      value.reuse.scope !==
        (attempt
          ? 'worker_attempt_private_checkpoints_and_process_local_decode_and_annotation_memo'
          : 'worker_process_local_decode_and_annotation_memo')
    )
      context.addIssue({
        code: 'custom',
        message: 'Reuse scope differs from command',
      });
    if (Date.parse(value.ended_at) < Date.parse(value.started_at))
      context.addIssue({
        code: 'custom',
        message: 'Observation UTC bounds regress',
      });
    if (value.phases.some((item) => item.ended_ms > value.work_ms))
      context.addIssue({
        code: 'custom',
        message: 'Phase exceeds command work',
      });
    if (value.outcome === 'completed' && value.failure_code !== null)
      context.addIssue({
        code: 'custom',
        message: 'Completed observation cannot have failure code',
      });
    if (
      value.inventory.observed_profile_id !== null &&
      value.inventory.observed_profile_id !== value.binding.profile_id
    )
      context.addIssue({ code: 'custom', message: 'Observed profile differs' });
    if (
      value.inventory.coverage === 'full' &&
      (!value.inventory.source_bytes_verified ||
        value.inventory.source_page_count !== value.inventory.prepared_pages)
    )
      context.addIssue({
        code: 'custom',
        message: 'Full inventory requires verified complete source',
      });
    if (
      value.inventory.observed_pages < value.inventory.prepared_pages ||
      (value.inventory.source_page_count !== null &&
        value.inventory.observed_pages > value.inventory.source_page_count)
    )
      context.addIssue({
        code: 'custom',
        message: 'Inventory exceeds observed source',
      });
    const prepared = value.inventory.prepared_pages;
    if (
      [
        value.inventory.language_pages,
        value.inventory.layout_pages,
        value.inventory.route_pages,
      ].some(
        (counts) =>
          Object.values(counts).reduce((sum, n) => sum + n, 0) !== prepared,
      )
    )
      context.addIssue({
        code: 'custom',
        message: 'Page classifications differ from prepared coverage',
      });
    if (
      value.resources.scratch_scan !== 'complete' &&
      value.resources.scratch_current_bytes !== null
    )
      context.addIssue({
        code: 'custom',
        message: 'Incomplete scratch scan cannot claim bytes',
      });
    if (
      value.resources.peak_rss_platform === 'unknown' &&
      value.resources.peak_rss_bytes !== null
    )
      context.addIssue({
        code: 'custom',
        message: 'Unknown RSS method cannot claim bytes',
      });
    for (const finding of value.findings)
      if (
        finding.kind === 'source' &&
        (finding.box.x0 < finding.region_box.x0 ||
          finding.box.y0 < finding.region_box.y0 ||
          finding.box.x1 > finding.region_box.x1 ||
          finding.box.y1 > finding.region_box.y1)
      )
        context.addIssue({
          code: 'custom',
          message: 'Source finding exceeds qualified region',
        });
  });
export type WorkerBinding = z.infer<typeof workerBinding>;
export type WorkerCommandExpectation = {
  command: z.infer<typeof workerCommand>;
  page_number: number | null;
};
export type WorkerObservationPacket = z.infer<typeof workerObservationPacket>;
export type WorkerObservationResult =
  | { status: 'OBSERVED'; packet: WorkerObservationPacket }
  | {
      status: 'UNOBSERVED';
      reason: 'NOT_EMITTED' | 'MALFORMED' | 'BINDING_MISMATCH' | 'UNAVAILABLE';
    };
export const workerObservationResult = z.union([
  z
    .object({ status: z.literal('OBSERVED'), packet: workerObservationPacket })
    .strict(),
  z
    .object({
      status: z.literal('UNOBSERVED'),
      reason: z.enum([
        'NOT_EMITTED',
        'MALFORMED',
        'BINDING_MISMATCH',
        'UNAVAILABLE',
      ]),
    })
    .strict(),
]);

export function parseWorkerObservation(
  stderr: string | undefined,
  expected: WorkerBinding,
  unit: WorkerCommandExpectation,
): WorkerObservationResult {
  if (!stderr) return { status: 'UNOBSERVED', reason: 'NOT_EMITTED' };
  if (Buffer.byteLength(stderr) > WORKER_OBSERVATION_BYTES)
    return { status: 'UNOBSERVED', reason: 'MALFORMED' };
  const lines = stderr
    .split('\n')
    .filter((line) => line.startsWith(WORKER_OBSERVATION_PREFIX));
  if (!lines.length) return { status: 'UNOBSERVED', reason: 'NOT_EMITTED' };
  if (
    lines.length !== 1 ||
    !stderr.endsWith('\n') ||
    Buffer.byteLength(lines[0]) + 1 > WORKER_OBSERVATION_BYTES
  )
    return { status: 'UNOBSERVED', reason: 'MALFORMED' };
  try {
    const result = workerObservationPacket.safeParse(
      JSON.parse(lines[0].slice(WORKER_OBSERVATION_PREFIX.length)),
    );
    if (!result.success) return { status: 'UNOBSERVED', reason: 'MALFORMED' };
    if (
      Object.keys(expected).some(
        (key) =>
          result.data.binding[key as keyof WorkerBinding] !==
          expected[key as keyof WorkerBinding],
      )
    )
      return { status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' };
    if (
      result.data.command !== unit.command ||
      result.data.page_number !== unit.page_number
    )
      return { status: 'UNOBSERVED', reason: 'BINDING_MISMATCH' };
    return { status: 'OBSERVED', packet: result.data };
  } catch {
    return { status: 'UNOBSERVED', reason: 'MALFORMED' };
  }
}
