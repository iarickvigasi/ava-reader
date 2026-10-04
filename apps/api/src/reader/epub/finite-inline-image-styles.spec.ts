import {
  finiteImageStyleFixture,
  FINITE_FIGURE_BYTES,
} from './finite-image-style-fixture';
import { ORDINARY_FIGURE_BYTES } from './ordinary-profile-fixture';

const CSS =
  '.illustration{margin-top:1em;margin-bottom:2em;margin-inline-start:.5em;text-align:center} p img.own{margin-top:0em;margin-bottom:0em;margin-inline-start:0em;text-align:left;background-color:#123456}';
const own = {
  align: 'left',
  block_indent_em: 0,
  space_before_em: 0,
  space_after_em: 0,
  background_color: '#123456',
};
it('uses complete own promoted image tokens over enclosing hints without changing addressing or resource bytes', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<p class="illustration">Before<a href="#after"><img id="art" class="own" src="figure.png" alt="Diagram"/></a>After</p><p id="after">Destination.</p>',
  );
  const blocks = book.chapters[0].blocks;
  expect(blocks.map((block) => [block.kind, block.text])).toEqual([
    ['paragraph', 'Before'],
    ['image', 'Diagram'],
    ['paragraph', 'After'],
    ['paragraph', 'Destination.'],
  ]);
  expect(blocks[1]).toMatchObject({
    anchorIds: ['art'],
    href: '#after',
    sourceOffset: 0,
    target: { blockId: blocks[3].id, textOffset: 0 },
    align: 'left',
    presentation: own,
    width: 300,
    height: 20,
    src: `data:image/png;base64,${FINITE_FIGURE_BYTES.toString('base64')}`,
  });
});
it('retains complete own finite image presentation when small illustrations stay inline', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<p class="illustration">Before<img id="small" class="own" src="figure.png" alt="Small diagram"/>After</p>',
    ORDINARY_FIGURE_BYTES,
  );
  const block = book.chapters[0].blocks[0];
  expect(block.text).toBe('BeforeAfter');
  if (!('inlines' in block)) throw Error('Missing inline illustration.');
  expect(block.inlines.find((inline) => inline.kind === 'image')).toMatchObject(
    {
      kind: 'image',
      anchorIds: ['small'],
      naturalWidth: 1,
      naturalHeight: 1,
      presentation: own,
      src: `data:image/png;base64,${ORDINARY_FIGURE_BYTES.toString('base64')}`,
    },
  );
});
it('lets explicit inline img style override own stylesheet declarations including zero values', async () => {
  const book = await finiteImageStyleFixture(
    CSS,
    '<p class="illustration"><img class="own" src="figure.png" style="margin-bottom:3em;margin-inline-start:0em;text-align:right" alt="Diagram"/></p>',
  );
  expect(book.chapters[0].blocks[0]).toMatchObject({
    kind: 'image',
    align: 'right',
    presentation: { ...own, align: 'right', space_after_em: 3 },
  });
});
