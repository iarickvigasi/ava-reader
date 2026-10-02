import { resolveTocNodes } from './toc';
import { build, image, text } from './opening-labels.fixture';

it.each([
  ['Chapter one', 'A Renaissance'],
  ['10', 'Intensive motherhood'],
  ['1', 'Old Friends'],
])('combines %s and its title before an epigraph', (number, title) => {
  const chapters = build(
    [[text(number), text(title), text('Quotation.', 'blockquote')]],
    number,
  );
  expect(chapters[0].label).toBe(`${number} / ${title}`);
  expect(chapters[0].title).toBe(chapters[0].label);
  const toc = resolveTocNodes(
    [{ id: 'toc', href: '0.xhtml', label: number, children: [] }],
    chapters,
  );
  expect(toc[0].label).toBe(chapters[0].label);
});

it.each([
  ['One', 'Clarity: Give Love Words'],
  ['9', 'The Spies'],
])('recognizes styled paragraphs beginning with %s', (number, title) => {
  const opening = [number, title].map((value) => ({
    ...text(value, 'paragraph'),
    align: 'center' as const,
    fontSizeScale: 1.375,
  }));
  expect(
    build([[...opening, image, text('Body text.', 'paragraph')]])[0].label,
  ).toBe(`${number} / ${title}`);
});

it('looks past two pictures for headings or prose without changing blocks', () => {
  const blocks = [image, image, text('Chapter one'), text('A Renaissance')];
  expect(build([blocks])[0]).toMatchObject({
    label: 'Chapter one / A Renaissance',
    blocks,
  });
  expect(
    build([
      [
        image,
        image,
        text('Four years ago, married to the father.', 'paragraph'),
      ],
    ])[0].label,
  ).toBe('1. Four years ago, married to the…');
});

it('looks beyond an image-only part divider, preserving its navigation and IDs', () => {
  const chapters = build([
    [image],
    [image, text('Four years ago, married to the father.', 'paragraph')],
  ]);
  expect(chapters[0].label).toBe('1. Four years ago, married to the…');
  expect(chapters[0].blocks).toEqual([image]);
  expect(chapters[0].nextChapterId).toBe(chapters[1].chapterId);
  expect(
    build([[{ ...image, alt: 'Cover' }], [text('Introduction')]])[0].label,
  ).toBe('1.');
  expect(build([[image]])[0].label).toBe('1.');
});

it('preserves complete authored TOC names and excludes later headings', () => {
  const blocks = [
    text('Chapter 1'),
    text('Introduction'),
    text('Body.', 'paragraph'),
    text('Later'),
  ];
  expect(build([blocks], 'Chapter 01 / Introduction')[0].label).toBe(
    'Chapter 01 / Introduction',
  );
  expect(build([[text('Body.', 'paragraph'), text('Later')]])[0].label).toBe(
    '1. Body…',
  );
});
