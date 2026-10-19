import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
// Known semantic guards only. Never retain source text, style values or arbitrary errors.
export const refinementValidationFinding = z
  .object({
    kind: z.literal('refinement'),
    code: z.literal('REFINEMENT_ROLE_BASELINE_INVALID'),
    stage: z.literal('refinement'),
    check: z.enum(['non_heading_ancestry', 'body_reference_size_baseline']),
    task_id_sha256: digest,
    node_id_sha256: digest,
    observation_sha256: digest,
    render_sha256: digest,
    page: z.number().int().min(1).max(500),
  })
  .strict();
