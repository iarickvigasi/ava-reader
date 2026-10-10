import { ordinaryProfilePackage } from './ordinary-profile-fixture';

describe('ordinary EPUB literal text and approved typography', () => {
  it('preserves verse, code and literal register whitespace exactly', async () => {
    const book = await ordinaryProfilePackage();
    const blocks = book.chapters[0].blocks;
    expect(blocks.find((block) => block.anchorId === 'poem')).toMatchObject({
      kind: 'verse',
      text: 'One light above the water,\nOne shadow on the foam,\nFour windows guide us home.',
    });
    expect(blocks.find((block) => block.anchorId === 'code')).toMatchObject({
      kind: 'code',
      text: 'lamp = 4\nif lamp > 0:\n    print("home")',
    });
    expect(blocks.find((block) => block.anchorId === 'register')).toMatchObject(
      {
        kind: 'paragraph',
        preserveWhitespace: true,
        text: 'North quay, lanterns\n    first watch, 3\n    return journey, 7',
      },
    );
    for (const block of blocks.filter((block) =>
      ['code', 'verse'].includes(block.kind),
    ))
      expect(
        'inlines' in block &&
          block.inlines
            .filter((inline) => inline.kind === 'text')
            .map((inline) => inline.text)
            .join(''),
      ).toBe(block.text);
  });
  it('keeps inherited language, explicit normal/false/zero resets and inline scripts', async () => {
    const book = await ordinaryProfilePackage();
    const blocks = book.chapters[0].blocks;
    const upright = blocks.find((block) => block.anchorId === 'upright');
    expect(upright).toMatchObject({
      kind: 'paragraph',
      fontWeight: 400,
      textIndent: 0,
      presentation: { italic: false, small_caps: false },
    });
    const aside = blocks.find((block) => block.anchorId === 'aside');
    expect(aside).toMatchObject({
      kind: 'aside',
      text: 'Майстерня — це частина книжки.',
    });
    expect(aside && 'inlines' in aside && aside.inlines[0]).toMatchObject({
      language: 'uk',
    });
    const inline = blocks.find((block) => block.anchorId === 'inline');
    if (!inline || !('inlines' in inline))
      throw new Error('Missing inline block');
    expect(
      inline.inlines.find(
        (item) =>
          item.kind === 'text' && item.text === '2' && item.script === 'sub',
      ),
    ).toBeDefined();
    expect(
      inline.inlines.find(
        (item) =>
          item.kind === 'text' && item.text === '2' && item.script === 'super',
      ),
    ).toBeDefined();
    expect(
      inline.inlines.find(
        (item) => item.kind === 'text' && item.text === 'reset',
      ),
    ).toMatchObject({
      fontWeight: 400,
      presentation: { italic: false, small_caps: false },
    });
    expect(
      inline.inlines.find(
        (item) => item.kind === 'text' && item.text === 'small capitals',
      ),
    ).toMatchObject({ presentation: { small_caps: true } });
  });
  it('retains wrapper and empty standalone anchors without adding readable text', async () => {
    const book = await ordinaryProfilePackage();
    const blocks = book.chapters[0].blocks;
    expect(blocks[0]).toMatchObject({
      anchorId: 'opening',
    });
    expect(blocks[0].anchorIds).toContain('wrapper');
    const last = blocks.find((block) => block.anchorId === 'after-empty');
    expect(last).toMatchObject({
      anchorIds: ['empty-before'],
      sourceAnchors: [
        { id: 'empty-end', textOffset: 'The last light stayed steady.'.length },
      ],
    });
    expect(blocks.some((block) => block.text === '')).toBe(false);
  });
});
