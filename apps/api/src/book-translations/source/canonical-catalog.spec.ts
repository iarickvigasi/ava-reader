import { fixture } from '../../reader/canonical/test-fixture';
import { canonicalSentenceCatalog } from './canonical-catalog';
import { canonicalTranslationContext } from './canonical-context';
it('preserves exact source leaf IDs, reading order, UTF16 offsets and literal code', () => {
  const { book } = fixture();
  const units = canonicalSentenceCatalog(book, 'chapter-one', 'final', 'en');
  const ids = [...new Set(units.map((u) => u.blockId))];
  const chapter = book.chapters[0];
  const expected = chapter.block_ids.flatMap((id) => {
    const b = book.blocks.find((b) => b.id === id)!;
    return b.kind === 'table'
      ? [...b.cells]
          .sort((a, b) => a.row - b.row || a.column - b.column)
          .map((c) => c.id)
      : [id];
  });
  expect(ids).toEqual(expected);
  for (const unit of units) {
    const block = book.blocks.find((b) => b.id === unit.blockId);
    const cell = book.blocks
      .flatMap((b) => (b.kind === 'table' ? b.cells : []))
      .find((c) => c.id === unit.blockId);
    const value =
      cell?.content ?? (block && 'content' in block ? block.content : null);
    if (value) {
      expect(value.text.slice(unit.startOffset, unit.endOffset)).toBe(
        unit.text,
      );
      expect(value.codepoint_utf16).toContain(unit.startOffset);
      expect(value.codepoint_utf16).toContain(unit.endOffset);
    }
  }
  const code = units.find((u) => u.blockId === 'code-one')!;
  expect(code.kind).toBe('literal');
  expect(code.text).toContain('\n');
  expect(units.some((u) => u.text.includes('😀'))).toBe(true);
  expect(
    canonicalSentenceCatalog(book, 'chapter-one', 'different-final', 'en').map(
      (u) => u.id,
    ),
  ).not.toEqual(units.map((u) => u.id));
});
it('display metadata edits do not change accepted segmentation, revision or source IDs', () => {
  const { item, accepted } = fixture();
  const request = {
    chapterId: 'chapter-one',
    targetLang: 'French',
    capability: { schema: 'ava-reader-3', build: 'b'.repeat(64) },
  };
  const before = canonicalTranslationContext(item, accepted, request);
  item.book.title = 'New title';
  item.book.language = 'ja';
  const after = canonicalTranslationContext(item, accepted, request);
  expect(after.units).toEqual(before.units);
  expect(after.contentRevision).toBe('final');
  expect(after.sourceLanguage).toBe(before.sourceLanguage);
  expect(after.canonicalAuthority).toMatchObject({
    operationId: 'operation',
    publicationId: 'publication',
    finalContentId: 'final',
  });
});
