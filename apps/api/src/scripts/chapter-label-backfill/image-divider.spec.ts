import { fixture } from './package.fixture';
import { relabelPackage } from './relabel-package';

it.each(['Chapter 1', '1.'])(
  'repairs image-only divider %s without changing blocks',
  (label) => {
    const original = fixture();
    original.chapters[0].label = original.toc[0].label = label;
    original.chapters[1].blocks = original.chapters[0].blocks;
    original.chapters[0].blocks = [
      {
        id: 'part',
        kind: 'image',
        src: 'part',
        alt: 'Part one',
        text: 'Part one',
      },
    ];
    const { readerPackage } = relabelPackage(original);
    expect(readerPackage.chapters[0].label).toBe(
      '1. It was a bright cold day…',
    );
    expect(readerPackage.chapters[0].blocks).toBe(original.chapters[0].blocks);
    expect(readerPackage.toc[0].label).toBe(readerPackage.chapters[0].label);
    expect(relabelPackage(readerPackage).changes).toEqual([]);
  },
);
