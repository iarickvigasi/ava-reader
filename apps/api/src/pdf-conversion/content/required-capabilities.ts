import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { ReaderPackageV3 } from '../contracts/generated/ava-reader-3';

export function requiredCapabilities(book: CanonicalBookV2) {
  type Capability = ReaderPackageV3['required_capabilities'][number];
  const required = new Set<Capability>(['text']);
  for (const block of book.blocks) {
    const nodes = block.kind === 'table' ? [block, ...block.cells] : [block];
    for (const node of nodes) {
      if (node.style_id) required.add('styles');
      if ('content' in node) {
        for (const span of node.content.spans ?? []) {
          if (span.style_id) required.add('styles');
          if (span.link) required.add('links');
        }
      }
    }
    if (block.kind === 'note') required.add('notes');
    if (block.kind === 'figure') required.add('figures');
    if (block.kind === 'table') required.add('tables');
    if (block.kind === 'list_item') required.add('lists');
    if (block.kind === 'code' || block.kind === 'verse')
      required.add('literal-text');
  }
  return [...required].sort();
}
