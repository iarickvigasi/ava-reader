import type { ReconstructionReport } from '../../../pdf-conversion/reconstruction/generated/ReconstructionReport';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { PdfPublicationError } from './errors';
import { validateSourceFeatureLocation } from './source-report-feature-location';
const fields = {
  family: 'family',
  weight: 'bold',
  italic: 'italic',
  first_line_indent: 'indent_em',
  block_inset: 'block_indent_em',
  relative_size: 'relative_size',
} as const;

export function validateSourceFeatures(
  report: ReconstructionReport,
  book: CanonicalBookV2,
  requireCurrent: boolean,
) {
  const ledger = report.source_feature_coverage;
  const current = report.schema_version === 'ava-reconstruction-report-2';
  const fail = () => {
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  };
  if ((requireCurrent && !current) || current !== Boolean(ledger)) fail();
  if (
    !current &&
    'finite_source_feature_dispositions_complete' in report.checks
  )
    fail();
  if (!ledger) return;
  if (
    ledger.policy_id !== 'ava-ocr-source-features-1' ||
    report.checks.finite_source_feature_dispositions_complete !== 'pass' ||
    ledger.requested_features !== ledger.evidence.length
  )
    fail();
  const inspected = ledger.evidence.filter((e) => e.task_id !== null).length;
  if (
    ledger.inspected_features !== inspected ||
    ledger.uninspected_features !== ledger.requested_features - inspected
  )
    fail();
  const identities = new Set<string>();
  for (const e of ledger.evidence) {
    const key = e.node_id + ':' + e.feature;
    if (
      identities.has(key) ||
      e.source_sha256 !== book.source.sha256 ||
      !e.canonical_block_id ||
      e.canonical_start === null ||
      e.canonical_start === undefined
    )
      fail();
    identities.add(key);
    const block = book.blocks.find((b) => b.id === e.canonical_block_id);
    if (!block || !('content' in block)) {
      fail();
      continue;
    }
    validateSourceFeatureLocation(book, e, block);
    const bound = [
      'comparison_budget_bound',
      'source_context_unavailable',
    ].includes(e.reason ?? '');
    const pins = [e.task_id, e.task_sha256, e.response_sha256, e.crop_sha256];
    if (
      bound
        ? e.disposition !== 'unknown' ||
          e.value !== null ||
          pins.some((p) => p !== null) ||
          e.crop_ids.length !== 0
        : pins.some((p) => p === null) ||
          e.crop_ids.length < 2 ||
          new Set(e.crop_ids).size !== e.crop_ids.length
    )
      fail();
    if (e.feature === 'paragraph_role' && e.disposition !== 'observed') fail();
    if (
      e.disposition === 'unknown' &&
      (e.value !== null ||
        ![
          'source_blurred',
          'source_clipped',
          'source_context_insufficient',
          'comparison_budget_bound',
          'source_context_unavailable',
        ].includes(e.reason ?? ''))
    )
      fail();
    if (
      e.disposition === 'not_applicable' &&
      (e.feature !== 'first_line_indent' ||
        block.kind !== 'heading' ||
        e.value !== null ||
        e.reason !== 'heading_has_no_prose_first_line')
    )
      fail();
    if (e.disposition === 'observed') {
      if (e.reason !== null || e.value === null) fail();
      if (e.feature === 'paragraph_role') {
        if (block.kind !== e.value) fail();
      } else {
        const style = book.styles.find((s) => s.id === block.style_id);
        if (!style || style[fields[e.feature]] !== e.value) fail();
      }
    }
  }
}
