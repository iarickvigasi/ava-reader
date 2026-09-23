import { BadRequestException } from '@nestjs/common';
import type { ReaderPackage } from '../reader-types';
import { parseReaderPackage } from './parse-reader-package';

function parse(value: unknown) {
  return parseReaderPackage(Buffer.from(JSON.stringify(value), 'utf8'));
}

function createPackage(): ReaderPackage {
  return {
    version: 2,
    manifest: {
      authors: ['Author'],
      language: 'en',
      sourceChecksum: 'checksum',
      title: 'Book',
      totalBlocks: 1,
      totalChapters: 1,
    },
    chapters: [
      {
        chapterId: 'chapter-1',
        href: 'chapter.xhtml',
        label: 'Chapter',
        title: 'Chapter',
        spineIndex: 0,
        previousChapterId: null,
        nextChapterId: null,
        blocks: [
          {
            id: 'block-1',
            kind: 'paragraph',
            text: 'Literal &#8217;',
            inlines: [],
          },
        ],
      },
    ],
    toc: [
      {
        id: 'chapter-node',
        chapterId: 'chapter-1',
        href: 'chapter.xhtml',
        label: 'Chapter',
        spineIndex: 0,
        anchorId: null,
        blockId: null,
        children: [
          {
            id: 'section-node',
            chapterId: 'chapter-1',
            href: 'chapter.xhtml#section',
            label: 'Section',
            spineIndex: 0,
            anchorId: 'section',
            blockId: 'block-1',
            children: [],
          },
        ],
      },
    ],
  };
}

describe('parseReaderPackage', () => {
  it.each([1, 0, 3, '2', null, undefined])(
    'rejects unsupported version %p',
    (version) => {
      expect(() => parse({ ...createPackage(), version })).toThrow(
        BadRequestException,
      );
    },
  );

  it('rejects a v1 package with a flat legacy TOC', () => {
    expect(() =>
      parse({
        ...createPackage(),
        version: 1,
        toc: [
          {
            chapterId: 'chapter-1',
            href: 'chapter.xhtml',
            label: 'Chapter',
            spineIndex: 0,
          },
        ],
      }),
    ).toThrow(BadRequestException);
  });

  it.each([null, [], {}, { version: 2, chapters: null }])(
    'rejects invalid envelope %p',
    (value) => {
      expect(() => parse(value)).toThrow(BadRequestException);
    },
  );

  it('preserves v2 nested TOC identities and navigation targets', () => {
    const stored = createPackage();
    expect(parse(stored)).toEqual(stored);
  });

  it('accepts a single-level v2 TOC', () => {
    const stored = createPackage();
    stored.toc[0].children = [];
    expect(parse(stored)).toEqual(stored);
  });

  it('normalizes legacy author metadata independently of package version', () => {
    const stored = createPackage();
    expect(
      parse({
        ...stored,
        manifest: {
          ...stored.manifest,
          authors: undefined,
          author: '  A &amp; B  ',
        },
      }).manifest.authors,
    ).toEqual(['A & B']);
  });

  it('prefers the authors array and removes blank authors', () => {
    const stored = createPackage();
    expect(
      parse({
        ...stored,
        manifest: {
          ...stored.manifest,
          authors: [' A ', '', '  ', 'B &amp; C'],
          author: 'Ignored',
        },
      }).manifest.authors,
    ).toEqual(['A', 'B & C']);
  });

  it('decodes display metadata without changing blocks or TOC navigation', () => {
    const stored = createPackage();
    stored.manifest.title = 'Book &amp; Title';
    stored.chapters[0].label = 'Chapter&#8217;s';
    stored.chapters[0].title = 'Title &amp; More';
    stored.toc[0].label = 'Part &amp; One';
    stored.toc[0].children[0].label = 'Section&#8217;s';
    const parsed = parse(stored);
    expect(parsed.manifest.title).toBe('Book & Title');
    expect(parsed.chapters[0]).toEqual({
      ...stored.chapters[0],
      label: 'Chapter’s',
      title: 'Title & More',
    });
    expect(parsed.toc[0]).toEqual({
      ...stored.toc[0],
      label: 'Part & One',
      children: [{ ...stored.toc[0].children[0], label: 'Section’s' }],
    });
  });
});
