import type {
  CanonicalBookV2,
  TextValue,
} from '../contracts/generated/ava-book-2';

// Count only the already validated canonical output, never source truth or
// private text. This traversal performs no new PDF parse or provider request.
export function outputInventory(book: CanonicalBookV2) {
  const languages = { en: 0, uk: 0, und: 0, unknown: 0 },
    links = { internal: 0, note: 0, external: 0 };
  const text = (value: TextValue) => {
    languages[value.language ?? 'unknown']++;
    for (const span of value.spans ?? [])
      if (span.link) links[span.link.kind]++;
  };
  let figures = 0,
    tables = 0,
    notes = 0;
  for (const block of book.blocks) {
    if ('content' in block) text(block.content);
    if (block.kind === 'table') {
      tables++;
      for (const cell of block.cells) text(cell.content);
    }
    if (block.kind === 'figure') figures++;
    if (block.kind === 'note') notes++;
  }
  return {
    scope: 'VALIDATED_CANONICAL_OUTPUT' as const,
    chapters: book.chapters.length,
    blocks: book.blocks.length,
    resources: book.resources.length,
    styles: book.styles.length,
    metadataClaims: book.metadata.length,
    figures,
    tables,
    notes,
    languages,
    links,
  };
}
