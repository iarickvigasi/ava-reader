import { parsePacket } from '../../../pdf-conversion/reconstruction/validate-packet';
import type { ReconstructionReport } from '../../../pdf-conversion/reconstruction/generated/ReconstructionReport';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { PdfPublicationError } from './errors';
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
  let report: ReconstructionReport;
  try {
    report = parsePacket('ReconstructionReport', bytes, 4 * 1024 ** 2);
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
