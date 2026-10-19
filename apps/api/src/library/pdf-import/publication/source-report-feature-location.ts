import { createHash } from 'node:crypto';
import type { SourceFeatureEvidence } from '../../../pdf-conversion/reconstruction/generated/ReconstructionReport';
import type { CanonicalBookV2 } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { PdfPublicationError } from './errors';
type TextBlock = Extract<
  CanonicalBookV2['blocks'][number],
  { content: unknown }
>;

export function validateSourceFeatureLocation(
  book: CanonicalBookV2,
  e: SourceFeatureEvidence,
  block: TextBlock,
) {
  const fail = () => {
    throw new PdfPublicationError('PDF_SOURCE_REPORT_INVALID');
  };
  const page = book.pages.find((p) => p.number === e.page);
  if (
    !page ||
    e.box.coordinate_space !== 'page_points_top_left' ||
    e.box.x1 > page.width_pt ||
    e.box.y1 > page.height_pt ||
    !block.evidence.some(
      (item) =>
        item.method === 'ocr' &&
        item.page === e.page &&
        item.box.coordinate_space === e.box.coordinate_space &&
        item.box.x0 === e.box.x0 &&
        item.box.y0 === e.box.y0 &&
        item.box.x1 === e.box.x1 &&
        item.box.y1 === e.box.y1,
    )
  )
    fail();
  if (e.canonical_start! + e.text_length > [...block.content.text].length)
    fail();
  const text = [...block.content.text]
    .slice(e.canonical_start!, e.canonical_start! + e.text_length)
    .join('');
  if (createHash('sha256').update(text).digest('hex') !== e.text_sha256) fail();
}
