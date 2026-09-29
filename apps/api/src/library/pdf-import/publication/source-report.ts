import { z } from 'zod';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { PdfPublicationError } from './errors';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const schema = z
  .object({
    schema_version: z.literal('ava-reconstruction-report-1'),
    source_sha256: digest,
    canonical_sha256: digest,
    epub_sha256: digest,
    resource_hashes: z.record(digest),
    profile_id: z.literal('ava-pdf-prose-en-v2'),
    outcome: z.literal('candidate'),
    page_count: z.number().int().min(1).max(500),
    recognition_task_count: z.number().int().min(0).max(25000),
    checks: z.record(z.enum(['pass', 'not_run'])),
    findings: z
      .array(
        z
          .object({
            code: z.string().min(1).max(100),
            message: z.string().min(1).max(1000),
            severity: z.enum(['blocking', 'review', 'information']),
            page: z.number().int().min(1).max(500).nullable().optional(),
            box: z
              .object({
                coordinate_space: z.enum([
                  'page_points_top_left',
                  'normalized_top_left',
                ]),
                x0: z.number().nonnegative(),
                y0: z.number().nonnegative(),
                x1: z.number().positive(),
                y1: z.number().positive(),
              })
              .strict()
              .nullable()
              .optional(),
            block_id: z.string().nullable().optional(),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();
const required = [
  'complete_source_pages',
  'complete_recognition_task_receipts',
  'native_character_conservation',
  'canonical_semantic_graph',
  'source_region_coverage',
  'note_list_table_relationships',
  'required_resource_byte_hashes',
  'declared_ocr_uncertainty_resolved',
  'source_structure_signals_consistent',
  'explicit_source_references_resolved',
];
export function parseSourceReport(
  bytes: Buffer,
  book: CanonicalBookV2,
  epubSha: string,
) {
  if (bytes.length > 4 * 1024 ** 2)
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  let report: z.infer<typeof schema>;
  try {
    report = schema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
  } catch {
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  }
  if (
    report.source_sha256 !== book.source.sha256 ||
    report.epub_sha256 !== epubSha ||
    report.page_count !== book.pages.length ||
    required.some((k) => report.checks[k] !== 'pass') ||
    Object.keys(report.resource_hashes).length !== book.resources.length ||
    book.resources.some((r) => report.resource_hashes[r.id] !== r.sha256)
  )
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  return report;
}
