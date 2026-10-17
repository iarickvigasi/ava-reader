import { z } from 'zod';
export const importReportSchema = z
  .object({
    schema_version: z.literal('ava-epub-import-1'),
    source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    final_content_id: z.string(),
    canonical_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    required_capabilities: z.array(z.string()),
    epubcheck: z
      .object({
        version: z.literal('5.4.0'),
        errors: z.array(z.string()).max(0),
        warnings: z.array(z.string()).max(10000),
      })
      .strict(),
  })
  .strict();
