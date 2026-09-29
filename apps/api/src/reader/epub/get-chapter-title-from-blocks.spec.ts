import type { ReaderBlock } from '../reader-types';
import { getChapterTitleFromBlocks } from './get-chapter-title-from-blocks';

const heading = (text: string): ReaderBlock => ({
  kind: 'heading',
  id: text,
  text,
  level: 2,
  inlines: [],
});
const paragraph = (text: string): ReaderBlock => ({
  kind: 'paragraph',
  id: text,
  text,
  inlines: [],
});

it.each(['1', 'I', 'Chapter 1', 'Part IV'])(
  'uses the title following %s',
  (number) => {
    expect(
      getChapterTitleFromBlocks(
        [
          {
            kind: 'image',
            id: 'cover',
            src: 'cover',
            alt: null,
            text: 'Cover',
          },
          paragraph(' '),
          heading(number),
          heading('Wanted: Men Who Love'),
          paragraph('Every female wants to be loved by a male.'),
        ],
        false,
      ),
    ).toBe('Wanted: Men Who Love');
  },
);

it('keeps a lone number and the first descriptive heading', () => {
  expect(getChapterTitleFromBlocks([heading('1')], false)).toBe('1');
  expect(
    getChapterTitleFromBlocks(
      [heading('Opening'), heading('Subtitle'), paragraph('Body.')],
      false,
    ),
  ).toBe('Opening');
});

it('does not promote later subsection headings', () => {
  expect(
    getChapterTitleFromBlocks(
      [paragraph('Body.'), heading('Later section')],
      false,
    ),
  ).toBeNull();
});

it('requires permission and following text for a short paragraph guess', () => {
  const blocks = [paragraph('“Come back.”'), paragraph('The story continues.')];
  expect(getChapterTitleFromBlocks(blocks, false)).toBeNull();
  expect(getChapterTitleFromBlocks(blocks)).toBe('“Come back.”');
  expect(getChapterTitleFromBlocks(blocks.slice(0, 1))).toBeNull();
  expect(getChapterTitleFromBlocks([])).toBeNull();
});
