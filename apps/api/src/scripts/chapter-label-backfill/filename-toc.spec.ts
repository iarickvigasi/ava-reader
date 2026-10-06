import { fixture } from './package.fixture';
import { relabelPackage } from './relabel-package';
import { relabelIndex } from './relabel-index';
import type { Prisma } from '@prisma/client';

it.each(['Chapter One', 'Chapter One / DISCOVERING SELF-COMPASSION'])(
  'repairs nested filename TOC labels when the chapter is %s',
  (label) => {
    const original = fixture();
    original.chapters[0].label = original.chapters[0].title = label;
    original.chapters[0].blocks = [
      'Chapter One',
      'DISCOVERING SELF-COMPASSION',
    ].map((text, i) => ({
      kind: 'heading',
      level: 2,
      id: `b${i}`,
      text,
      inlines: [],
    }));
    const child = { ...original.toc[0], label: 'c0.xhtml' };
    original.toc = [
      {
        ...child,
        id: 'part',
        chapterId: null,
        label: 'Part One',
        children: [child],
      },
    ];
    const { readerPackage, changes } = relabelPackage(original);
    expect(changes.some((change) => change.chapterId === 'c0')).toBe(true);
    expect(readerPackage.toc[0].label).toBe('Part One');
    expect(readerPackage.toc[0].children[0].label).toBe(
      'Chapter One / DISCOVERING SELF-COMPASSION',
    );
    expect(readerPackage.chapters[0].blocks).toBe(original.chapters[0].blocks);
    expect(relabelPackage(readerPackage).changes).toEqual([]);
    const index = {
      version: 1,
      totalBlocks: 2,
      chapters: [
        { chapterId: 'c0', label, title: label, blockIds: ['b0', 'b1'] },
      ],
      toc: original.toc,
    };
    const repaired = relabelIndex(
      index as Prisma.JsonValue,
      changes,
    ) as unknown as typeof index;
    expect(repaired.toc).toEqual(readerPackage.toc);
    expect(repaired.chapters[0].blockIds).toEqual(index.chapters[0].blockIds);
  },
);
