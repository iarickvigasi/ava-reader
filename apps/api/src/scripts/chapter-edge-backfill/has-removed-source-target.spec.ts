import type { ReaderPackage } from '../../reader/reader-types';
import { hasRemovedSourceTarget } from './has-removed-source-target';

const target = { chapterId: 'removed', blockId: 'target', textOffset: 0 };
const text = { kind: 'text', text: 'Go', target };
it.each([
  { kind: 'paragraph', inlines: [text] },
  { kind: 'paragraph', inlines: [{ kind: 'image', src: 'small.png', target }] },
  { kind: 'image', src: 'figure.png', target },
  { kind: 'list', items: [{ inlines: [text] }] },
  {
    kind: 'list',
    items: [{ children: [{ kind: 'list', items: [{ inlines: [text] }] }] }],
  },
  { kind: 'table', cells: [{ inlines: [text] }] },
  { kind: 'note', inlines: [], returns: [{ label: 'Return', target }] },
])('blocks a supported source target in %j without changing it', (block) => {
  const pkg = { chapters: [{ blocks: [block] }] } as unknown as ReaderPackage;
  const before = JSON.stringify(pkg);
  expect(hasRemovedSourceTarget(pkg, new Set(['removed']))).toBe(true);
  expect(JSON.stringify(pkg)).toBe(before);
  expect(hasRemovedSourceTarget(pkg, new Set(['other']))).toBe(false);
});
it('permits surviving typed targets and external links; TOC entries are regrouped separately', () => {
  const pkg = {
    toc: [{ chapterId: 'removed' }],
    chapters: [
      {
        blocks: [
          {
            kind: 'paragraph',
            inlines: [
              { kind: 'text', text: 'Web', href: 'https://example.com' },
            ],
          },
          { kind: 'image', target: { ...target, chapterId: 'surviving' } },
        ],
      },
    ],
  } as unknown as ReaderPackage;
  expect(hasRemovedSourceTarget(pkg, new Set(['removed']))).toBe(false);
});
