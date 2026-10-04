import {
  ordinaryProfilePackage,
  ORDINARY_FIGURE_BYTES,
} from './ordinary-profile-fixture';

describe('ordinary EPUB bounded structure', () => {
  it('retains figure bytes, intrinsic geometry and an addressable associated caption', async () => {
    const book = await ordinaryProfilePackage();
    const blocks = book.chapters[0].blocks;
    const image = blocks.find((block) => block.kind === 'image');
    const caption = blocks.find((block) => block.kind === 'caption');
    expect(image).toMatchObject({
      anchorId: 'art',
      kind: 'image',
      width: 1,
      height: 1,
      alt: 'One window',
      captionId: caption?.id,
    });
    expect(
      image?.kind === 'image' && Buffer.from(image.src.split(',')[1], 'base64'),
    ).toEqual(ORDINARY_FIGURE_BYTES);
    expect(caption).toMatchObject({
      anchorId: 'caption',
      text: 'Figure 1. One window.',
    });
    expect(blocks.indexOf(image!)).toBeLessThan(blocks.indexOf(caption!));
  });
  it('retains list hierarchy, start, marker styles and each item exactly once', async () => {
    const book = await ordinaryProfilePackage();
    const list = book.chapters[0].blocks.find((block) => block.kind === 'list');
    expect(list).toMatchObject({
      ordered: true,
      start: 3,
      items: [
        { anchorId: 'first-item', text: 'Pack the lantern.' },
        { text: 'Fold the map.' },
      ],
    });
    if (list?.kind !== 'list') throw new Error('Missing list');
    expect(list.items[0].children?.[0]).toMatchObject({
      ordered: true,
      start: 2,
      markerStyle: 'lower-alpha',
      items: [
        { anchorId: 'nested-item', text: 'Check the wick.' },
        { text: 'Keep the spare match dry.' },
      ],
    });
    expect(list.text).toBe(
      'Pack the lantern.\nCheck the wick.\nKeep the spare match dry.\nFold the map.',
    );
    const ids = [
      list.id,
      ...list.items.map((item) => item.id),
      list.items[0].children![0].id,
      ...list.items[0].children![0].items.map((item) => item.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.includes('temp-id'))).toBe(false);
  });
  it('retains exact table order, spans, header axes and header references', async () => {
    const book = await ordinaryProfilePackage();
    const blocks = book.chapters[0].blocks;
    const table = blocks.find((block) => block.kind === 'table');
    if (table?.kind !== 'table') throw new Error('Missing table');
    expect(
      table.cells.map((cell) => [
        cell.row,
        cell.column,
        cell.text,
        cell.headerAxis,
      ]),
    ).toEqual([
      [0, 0, 'Place', 'column'],
      [0, 1, 'Lamps', 'column'],
      [1, 0, 'Harbour', 'row'],
      [1, 1, '4', null],
      [2, 0, 'Workshop', null],
      [2, 1, '2', null],
      [3, 1, '3', null],
    ]);
    expect(table.cells[4].rowSpan).toBe(2);
    expect(table.cells[3].headerIds).toEqual([
      table.cells[2].id,
      table.cells[1].id,
    ]);
    expect(blocks.find((block) => block.id === table.captionId)).toMatchObject({
      kind: 'caption',
      text: 'The lamp register',
    });
    expect(new Set(table.cells.map((cell) => cell.id)).size).toBe(7);
  });
});
