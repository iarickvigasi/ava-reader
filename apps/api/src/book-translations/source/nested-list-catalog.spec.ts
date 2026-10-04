import { buildSentenceCatalog } from './sentence-catalog';
import { ordinaryProfilePackage } from '../../reader/epub/ordinary-profile-fixture';
import type { ReaderListBlock } from '../../reader/reader-types';

it('uses item-local UTF-16 coordinates throughout a newly supported nested ordinary list', async () => {
  const book = await ordinaryProfilePackage();
  const chapter = book.chapters[0];
  const list = chapter.blocks.find(
    (block): block is ReaderListBlock => block.kind === 'list',
  )!;
  const units = buildSentenceCatalog(chapter, 'fresh-nested-revision', 'en');
  const items = [
    ...list.items.slice(0, 1),
    ...list.items[0].children![0].items,
    ...list.items.slice(1),
  ];
  expect(items.map((item) => item.text)).toEqual([
    'Pack the lantern.',
    'Check the wick.',
    'Keep the spare match dry.',
    'Fold the map.',
  ]);
  const listUnits = units.filter((unit) =>
    items.some((item) => item.id === unit.blockId),
  );
  expect(listUnits.map((unit) => unit.text)).toEqual(
    items.map((item) => item.text),
  );
  expect(listUnits.map((unit) => unit.blockId)).toEqual(
    items.map((item) => item.id),
  );
  for (const unit of listUnits) {
    const item = items.find((item) => item.id === unit.blockId)!;
    expect(unit.itemId).toBe(item.id);
    expect(item.text.slice(unit.startOffset, unit.endOffset)).toBe(unit.text);
  }
  expect(listUnits.at(-1)).toMatchObject({
    blockId: list.items[1].id,
    startOffset: 0,
  });
});
