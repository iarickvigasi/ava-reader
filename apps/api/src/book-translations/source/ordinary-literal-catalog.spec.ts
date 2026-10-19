import { buildSentenceCatalog } from './sentence-catalog';
import { chapterFixture } from '../testing/translation.fixture';
import type { ReaderChapter } from '../../reader/reader-types';

it('retains newly supported rules, code and verse as non-generating literal units', () => {
  const text = 'One line.\n    Second line.';
  const chapter: ReaderChapter = {
    ...chapterFixture,
    blocks: [
      {
        id: 'rule',
        kind: 'separator',
        text: '',
        presentation: { id: 'spacing', space_before_em: 1 },
      },
      { id: 'code', kind: 'code', text, inlines: [{ kind: 'text', text }] },
      { id: 'verse', kind: 'verse', text, inlines: [{ kind: 'text', text }] },
    ],
  };
  expect(
    buildSentenceCatalog(chapter, 'new-literal-revision', 'en'),
  ).toMatchObject([
    {
      blockId: 'rule',
      text: '',
      kind: 'literal',
      startOffset: 0,
      endOffset: 0,
    },
    {
      blockId: 'code',
      text,
      kind: 'literal',
      startOffset: 0,
      endOffset: text.length,
    },
    {
      blockId: 'verse',
      text,
      kind: 'literal',
      startOffset: 0,
      endOffset: text.length,
    },
  ]);
});
