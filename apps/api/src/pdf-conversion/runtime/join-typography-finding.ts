import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const joinTypographyFinding = z
  .object({
    kind: z.literal('refinement'),
    code: z.literal('JOIN_TYPOGRAPHY_CONFLICT'),
    stage: z.literal('refinement'),
    task_id_sha256: digest,
    edge_id_sha256: digest,
    previous_id_sha256: digest,
    next_id_sha256: digest,
    observation_sha256: digest,
    render_sha256: digest,
    previous_page: z.number().int().min(1).max(500),
    next_page: z.number().int().min(1).max(500),
    conflicting_fields: z
      .array(
        z.enum([
          'family',
          'color',
          'background_color',
          'decoration_color',
          'underline',
          'strike_through',
          'bold',
          'italic',
          'small_caps',
          'relative_size',
          'vertical_align',
          'align',
          'line_height',
          'space_after_em',
          'block_indent_em',
          'style',
        ]),
      )
      .min(1)
      .max(16),
  })
  .strict()
  .refine(
    (value) =>
      JSON.stringify(value.conflicting_fields) ===
      JSON.stringify([...new Set(value.conflicting_fields)].sort()),
  );
