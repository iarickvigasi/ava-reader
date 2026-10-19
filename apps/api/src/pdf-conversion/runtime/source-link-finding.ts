import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const sourceLinkFinding = z
  .object({
    kind: z.literal('source_link'),
    code: z.enum([
      'PDF_LINK_ACTION_REQUIRES_REVIEW',
      'PDF_LINK_TARGET_REQUIRES_REVIEW',
      'PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW',
      'PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW',
      'SOURCE_LINK_UNEXPECTED_FAILURE',
    ]),
    link_step: z.enum(['navigation', 'caller', 'application']),
    page: z.number().int().min(1).max(500),
    annotation_number: z.number().int().min(1).max(1000),
    observation_sha256: digest,
    render_sha256: digest,
  })
  .strict();

export function validateFailureFindings(
  value: {
    command: string;
    outcome: string;
    failure_code: string | null;
    findings: { kind: string }[];
    findings_complete: boolean;
  },
  context: z.RefinementCtx,
) {
  for (const kind of ['refinement', 'source_link']) {
    if (!value.findings.some((finding) => finding.kind === kind)) continue;
    const commands =
      kind === 'refinement'
        ? [
            'validate_refinement',
            'prepare_refinement',
            'reconstruct',
            'reconstruct_stream',
            'attempt_stream',
          ]
        : [
            'prepare_refinement',
            'reconstruct',
            'reconstruct_stream',
            'attempt_stream',
          ];
    if (
      !commands.includes(value.command) ||
      value.outcome !== 'failed' ||
      value.failure_code !== 'RECONSTRUCTION_REVIEW_REQUIRED' ||
      value.findings.length !== 1 ||
      !value.findings_complete
    )
      context.addIssue({
        code: 'custom',
        message: 'Finding requires one complete bound failure',
      });
  }
}
