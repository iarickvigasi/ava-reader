import {
  finiteImageStyleFixture,
  FINITE_FIGURE_BYTES,
} from './finite-image-style-fixture';

const CSS =
  '.illustration{margin-top:1em;margin-bottom:2em;margin-inline-start:.5em;text-align:center}.rule{margin-top:1em;margin-bottom:1em}';
const illustration = {
  align: 'center',
  block_indent_em: 0.5,
  space_before_em: 1,
  space_after_em: 2,
};
it('keeps approved figure/image and separator tokens with exact caption/resource associations', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<figure id="figure" class="illustration"><img id="art" src="figure.png" alt="Diagram"/><figcaption id="caption">Diagram caption.</figcaption></figure><hr id="rule" class="rule"/>',
  );
  const blocks = book.chapters[0].blocks;
  const image = blocks.find((block) => block.kind === 'image');
  const caption = blocks.find((block) => block.kind === 'caption');
  expect(image).toMatchObject({
    anchorId: 'art',
    anchorIds: ['figure'],
    width: 300,
    height: 20,
    captionId: caption?.id,
    align: 'center',
    presentation: illustration,
    src: `data:image/png;base64,${FINITE_FIGURE_BYTES.toString('base64')}`,
  });
  expect(caption).toMatchObject({
    anchorId: 'caption',
    text: 'Diagram caption.',
  });
  expect(blocks.find((block) => block.kind === 'separator')).toMatchObject({
    anchorId: 'rule',
    text: '',
    presentation: { space_before_em: 1, space_after_em: 1 },
  });
});
it('retains image/separator own zero reset declarations over containing approved hints', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<figure class="illustration"><img id="art" src="figure.png" style="margin-top:0em;margin-bottom:0em;margin-inline-start:0em;text-align:left"/></figure><div class="illustration"><hr id="rule" style="margin-top:0em;margin-bottom:0em;margin-inline-start:0em;text-align:left"/></div>',
  );
  for (const block of book.chapters[0].blocks)
    expect(block).toMatchObject({
      align: 'left',
      presentation: {
        align: 'left',
        block_indent_em: 0,
        space_before_em: 0,
        space_after_em: 0,
      },
    });
});
it('retains enclosing approved hints when a large inline illustration is promoted without changing prose order', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<p id="paragraph" class="illustration">Before<img id="art" src="figure.png" alt="Diagram"/>After</p>',
  );
  const blocks = book.chapters[0].blocks;
  expect(blocks.map((block) => [block.kind, block.text])).toEqual([
    ['paragraph', 'Before'],
    ['image', 'Diagram'],
    ['paragraph', 'After'],
  ]);
  expect(blocks[1]).toMatchObject({
    anchorIds: ['art'],
    align: 'center',
    width: 300,
    height: 20,
    presentation: illustration,
    src: `data:image/png;base64,${FINITE_FIGURE_BYTES.toString('base64')}`,
  });
});
