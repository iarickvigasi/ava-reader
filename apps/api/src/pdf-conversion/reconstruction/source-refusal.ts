import { z } from 'zod';
import { PdfRuntimeError } from '../runtime/runtime-error';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,119}$/);
// A legal 100-finding diagnostic can exceed 64KiB; retain it without truncating findings.
export const SOURCE_REFUSAL_BYTES = 256 * 1024;
const box = z
  .object({
    coordinate_space: z.literal('page_points_top_left'),
    x0: z.number().finite().min(0).max(20000),
    y0: z.number().finite().min(0).max(20000),
    x1: z.number().finite().positive().max(20000),
    y1: z.number().finite().positive().max(20000),
  })
  .strict()
  .refine((b) => b.x0 < b.x1 && b.y0 < b.y1);

export const sourceRefusalSchema = z
  .object({
    schema_version: z.literal('ava-source-refusal-1'),
    source_sha256: digest,
    stage: z.enum(['extraction', 'assembly']),
    findings: z
      .array(
        z
          .object({
            code: z.enum([
              'ESSENTIAL_STRUCTURE_UNSUPPORTED',
              'RECOGNITION_UNRESOLVED',
              'SOURCE_LANGUAGE_UNSUPPORTED',
            ]),
            severity: z.literal('blocking'),
            page: z.number().int().min(1).max(500),
            box,
            region_box: box,
            block_id: identity.nullable(),
            segment_id_sha256: digest.nullable(),
            task_id: identity.nullable(),
            render_sha256: digest.nullable(),
          })
          .strict()
          .refine(
            (f) =>
              f.box.x0 >= f.region_box.x0 &&
              f.box.y0 >= f.region_box.y0 &&
              f.box.x1 <= f.region_box.x1 &&
              f.box.y1 <= f.region_box.y1,
          ),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type SourceRefusalDiagnostic = z.infer<typeof sourceRefusalSchema>;

export class SourceContentError extends PdfRuntimeError {
  private readonly value: SourceRefusalDiagnostic;
  constructor(diagnostic: SourceRefusalDiagnostic) {
    super('UNSUPPORTED_PDF');
    const parsed = sourceRefusalSchema.safeParse(diagnostic);
    if (!parsed.success) throw new PdfRuntimeError('INVALID_RESULT');
    this.value = parsed.data;
  }
  diagnostic() {
    return structuredClone(this.value);
  }
}

export function parseSourceRefusal(bytes: Buffer, sourceSha256: string) {
  if (bytes.length > SOURCE_REFUSAL_BYTES)
    throw new PdfRuntimeError('INVALID_RESULT');
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new PdfRuntimeError('INVALID_RESULT');
  }
  const parsed = sourceRefusalSchema.safeParse(raw);
  if (!parsed.success) throw new PdfRuntimeError('INVALID_RESULT');
  if (parsed.data.source_sha256 !== sourceSha256)
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return new SourceContentError(parsed.data);
}
