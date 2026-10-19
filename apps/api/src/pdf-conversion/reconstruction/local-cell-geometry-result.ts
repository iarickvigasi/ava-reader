import { z } from 'zod';
import { LOCAL_CELL_OCR_POLICY } from '../../library/pdf-import/admission/cell-ocr-policy';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const base = z.object({
  schema_version: z.literal('ava-cell-geometry-localization-1'),
  origin: z.literal('LOCAL_OCR'),
  method: z.literal(LOCAL_CELL_OCR_POLICY),
  request_sha256: digest,
  task_id: z.string().regex(/^recognition-cell-geometry-[a-f0-9]{64}$/),
  source_sha256: digest,
  render_sha256: digest,
  original_response_sha256: digest,
  languages: z.enum(['eng', 'eng+ukr']),
  binary_sha256: digest,
  traineddata_sha256: z.array(digest).min(1).max(2),
  tsv_base64: z.string().max(349528),
  tsv_byte_length: z.number().int().min(0).max(262144),
  tsv_sha256: digest,
});
export const localCellGeometryResult = z.discriminatedUnion('status', [
  base
    .extend({
      status: z.literal('PROVED'),
      reason: z.null(),
      response_json: z
        .string()
        .min(1)
        .max(1024 ** 2),
      response_sha256: digest,
    })
    .strict(),
  base
    .extend({
      status: z.literal('NO_PROOF'),
      reason: z.enum([
        'NO_UNIQUE_SOURCE_LINE',
        'OCR_UNAVAILABLE',
        'OCR_EVIDENCE_BOUND',
      ]),
      response_json: z.null(),
      response_sha256: z.null(),
    })
    .strict(),
]);
export type LocalCellGeometryResult = z.infer<typeof localCellGeometryResult>;
