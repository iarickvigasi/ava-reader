import { fixture } from './package.fixture';
import { relabelPackage } from './relabel-package';
import type { ReaderBlock } from '../../reader/reader-types';

const centered = (text: string, fontSizeScale?: number): ReaderBlock => ({
  kind: 'paragraph',
  id: text,
  text,
  inlines: [],
  align: 'center',
  fontSizeScale,
});

it.each([
  [
    'CHAPTER 1',
    [
      centered('CHAPTER 1'),
      centered('GIRLS RULE'),
      centered('Boys Are Behind in Education'),
    ],
    'CHAPTER 1 / GIRLS RULE / Boys Are Behind in Education',
  ],
  [
    'Introduction',
    [
      { ...centered('Introduction'), kind: 'heading', level: 1 },
      centered('Morality and the Body', 1.125),
    ],
    'Introduction / Morality and the Body',
  ],
  [
    '1 / Title',
    [
      { ...centered('1'), kind: 'heading', level: 1 },
      { ...centered('Title'), kind: 'heading', level: 2 },
      centered('Subtitle', 1.125),
    ],
    '1 / Title / Subtitle',
  ],
] as [string, ReaderBlock[], string][])(
  'repairs %s without changing blocks or IDs',
  (label, opening, expected) => {
    const original = fixture();
    original.chapters[0].label = original.toc[0].label = label;
    original.chapters[0].blocks.unshift(...opening);
    const { readerPackage } = relabelPackage(original);
    expect(readerPackage.chapters[0].label).toBe(expected);
    expect(readerPackage.toc[0].label).toBe(expected);
    expect(readerPackage.chapters[0].blocks).toBe(original.chapters[0].blocks);
    expect(relabelPackage(readerPackage).changes).toEqual([]);
  },
);

it('repairs a heading-only book-title page previously labelled with a number', () => {
  const original = fixture();
  original.chapters[0].label = '1.';
  original.chapters[0].blocks = [
    {
      kind: 'heading',
      level: 1,
      id: 'title',
      text: original.manifest.title,
      inlines: [],
    },
  ];
  expect(relabelPackage(original).readerPackage.chapters[0].label).toBe(
    original.manifest.title,
  );
});
