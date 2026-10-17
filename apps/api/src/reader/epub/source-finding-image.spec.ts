import { createHash } from 'crypto';
import { importSourceFindingFixture } from './source-finding-fixture';
import { orderedXmlParser, type OrderedNode } from './xml-utils';
import { preflightRequiredImages } from './preflight-required-images';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAASwAAAAUCAIAAAC4QZdWAAAAVElEQVR4nO3VMREAIAADsYJ/zyDjl8RAp7+e7Q3o3HAbECH0PCHERAgxEUJMhBATIcRECDERQkyEEBMhxEQIMRFCTIQQEyHERAgxEUJMhBATIaz1AeU4AScvZtPtAAAAAElFTkSuQmCC',
  'base64',
);
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
it.each([
  [
    '<figure id="figure"><img id="image" src="missing.png" alt="Required diagram"/><figcaption>Caption</figcaption></figure>',
    [0, 1, 0],
    'figure',
  ],
  [
    '<p id="paragraph">Before<img id="image" src="missing.png" alt="Required equation"/>After</p>',
    [0, 1, 1],
    'paragraph',
  ],
  [
    '<p id="paragraph"><img id="image" alt="Required image"/></p>',
    [0, 1, 0],
    'paragraph',
  ],
  [
    '<p id="paragraph"><img id="image" src="https://example.invalid/image.png"/></p>',
    [0, 1, 0],
    'paragraph',
  ],
] as const)(
  'refuses missing required images at their exact source element',
  async (body, treePath, parent) => {
    await expect(importSourceFindingFixture(body)).rejects.toMatchObject({
      message: 'This EPUB contains a structure AVA cannot preserve.',
      finding: {
        schema: 'ava.epub-source-finding.v1',
        code: 'EPUB_REQUIRED_IMAGE_MISSING',
        source: {
          resourcePath: 'OEBPS/text/body.xhtml',
          elementTag: 'img',
          treePath,
          siblingIndex: treePath.at(-1),
          elementIdSha256: hash('image'),
          parentIdSha256: hash(parent),
        },
      },
    });
  },
);
it('retains available image bytes, dimensions and figure caption association', async () => {
  const book = await importSourceFindingFixture(
    '<figure><img id="image" src="../images/figure.png" alt="Required diagram"/><figcaption id="caption">Diagram caption.</figcaption></figure>',
    { 'OEBPS/images/figure.png': png },
  );
  const blocks = book.chapters[0].blocks;
  const caption = blocks.find((block) => block.kind === 'caption');
  expect(blocks.find((block) => block.kind === 'image')).toMatchObject({
    src: `data:image/png;base64,${png.toString('base64')}`,
    width: 300,
    height: 20,
    captionId: caption?.id,
    alt: 'Required diagram',
  });
  expect(caption?.text).toBe('Diagram caption.');
});
it('reuses preflight image reads and never resolves external resources', async () => {
  const asset = {
    src: 'data:image/png;base64,bytes',
    naturalWidth: 20,
    naturalHeight: 10,
  };
  const read = jest.fn().mockResolvedValue(asset);
  const nodes = orderedXmlParser.parse(
    '<p><img src="figure.png"/><img src="figure.png"/></p>',
  ) as OrderedNode[];
  const resolve = await preflightRequiredImages(nodes, read);
  expect(await resolve('figure.png')).toBe(asset);
  expect(read).toHaveBeenCalledTimes(1);
  await expect(
    preflightRequiredImages(
      orderedXmlParser.parse(
        '<img src="https://example.invalid/img"/>',
      ) as OrderedNode[],
      read,
    ),
  ).rejects.toMatchObject({ finding: { code: 'EPUB_REQUIRED_IMAGE_MISSING' } });
  expect(read).toHaveBeenCalledTimes(1);
});
