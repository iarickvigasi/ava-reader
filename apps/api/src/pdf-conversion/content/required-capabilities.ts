import type { CanonicalBookV2 } from '../contracts/generated/ava-book-2';
import type { ReaderPackageV3 } from '../contracts/generated/ava-reader-3';

export function requiredCapabilities(book: CanonicalBookV2) {
  type Capability = ReaderPackageV3['required_capabilities'][number];
  const required = new Set<Capability>(['text']);
  const styles = new Map(book.styles.map((style) => [style.id, style]));
  function useStyle(id?: string | null) {
    if (!id) return;
    required.add('styles');
    const style = styles.get(id);
    if (
      style &&
      [
        style.color,
        style.background_color,
        style.decoration_color,
        style.underline,
        style.strike_through,
      ].some((value) => value != null)
    )
      required.add('annotation-styles');
  }
  for (const block of book.blocks) {
    const nodes = block.kind === 'table' ? [block, ...block.cells] : [block];
    for (const node of nodes) {
      useStyle(node.style_id);
      if ('content' in node) {
        if (node.content.language != null) required.add('language');
        for (const span of node.content.spans ?? []) {
          useStyle(span.style_id);
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
