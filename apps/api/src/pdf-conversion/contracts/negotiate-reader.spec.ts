import { fixtureBytes } from './contract-fixtures';
import { parseContractJson } from './parse-json';
import type { ReaderPackageV3 } from './generated/ava-reader-3';
import { negotiateReader } from './negotiate-reader';

const legacy = {
  version: 2,
  manifest: {
    title: 'A &amp; B',
    author: ' Writer ',
    language: 'en',
    sourceChecksum: 'test',
    totalBlocks: 0,
    totalChapters: 1,
  },
  chapters: [
    {
      chapterId: 'c1',
      href: 'c1.xhtml',
      label: 'One',
      title: 'One',
      spineIndex: 0,
      previousChapterId: null,
      nextChapterId: null,
      blocks: [],
    },
  ],
  toc: [],
};
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const semantic = jest.fn(() => Promise.resolve(true));

describe('reader compatibility', () => {
  it('refuses literal labels when the reader cannot suppress generated markers', async () => {
    const reader = parseContractJson(
      fixtureBytes('ava-reader-3'),
    ) as ReaderPackageV3;
    const previous = [...reader.required_capabilities];
    reader.book.lists[0].marker_style = 'none';
    reader.required_capabilities.push('literal-list-markers');
    expect(
      await negotiateReader(
        bytes(reader),
        { versions: [3], capabilities: previous },
        semantic,
      ),
    ).toEqual({ status: 'upgrade_required', version: 3 });
    expect(
      (
        await negotiateReader(
          bytes(reader),
          { versions: [3], capabilities: reader.required_capabilities },
          semantic,
        )
      ).status,
    ).toBe('compatible');
  });
  it('refuses styled markers without their explicit reader capability', async () => {
    const reader = parseContractJson(
      fixtureBytes('ava-reader-3'),
    ) as ReaderPackageV3;
    const item = reader.book.blocks.find((b) => b.kind === 'list_item')!;
    if (item.kind !== 'list_item') throw Error('fixture requires list');
    item.marker_style_id = 'source-marker';
    reader.book.styles.push({ id: 'source-marker', bold: false });
    reader.required_capabilities.push('list-marker-styles');
    const previous = reader.required_capabilities.filter(
      (c) => c !== 'list-marker-styles',
    );
    expect(
      await negotiateReader(
        bytes(reader),
        { versions: [3], capabilities: previous },
        semantic,
      ),
    ).toEqual({ status: 'upgrade_required', version: 3 });
    expect(
      (
        await negotiateReader(
          bytes(reader),
          { versions: [3], capabilities: reader.required_capabilities },
          semantic,
        )
      ).status,
    ).toBe('compatible');
  });
  it('requires the explicit capability for exact source-page books', async () => {
    const input = fixtureBytes('ava-reader-3', 'source-pages');
    const reader = parseContractJson(input) as ReaderPackageV3;
    expect(reader.required_capabilities).toContain('source-page-starts');
    const previous = reader.required_capabilities.filter(
      (capability) => capability !== 'source-page-starts',
    );
    expect(
      await negotiateReader(
        input,
        { versions: [3], capabilities: previous },
        semantic,
      ),
    ).toEqual({ status: 'upgrade_required', version: 3 });
    const supported = await negotiateReader(
      input,
      { versions: [3], capabilities: reader.required_capabilities },
      semantic,
    );
    expect(supported.status).toBe('compatible');
    expect(semantic).toHaveBeenCalled();
  });
  beforeEach(() => semantic.mockClear());
  it('keeps the existing v2 parser and legacy author normalization', async () => {
    const result = await negotiateReader(
      bytes(legacy),
      { versions: [2], capabilities: [] },
      semantic,
    );
    expect(result.status).toBe('compatible');
    if (result.status === 'compatible' && result.version === 2) {
      expect(result.package.manifest.authors).toEqual(['Writer']);
      expect(result.package.manifest.title).toBe('A & B');
    }
    expect(semantic).not.toHaveBeenCalled();
  });
  it('never downgrades v3 into the current v2 renderer', async () => {
    expect(
      await negotiateReader(
        bytes({ version: 3 }),
        { versions: [2], capabilities: [] },
        semantic,
      ),
    ).toEqual({ status: 'upgrade_required', version: 3 });
    expect(semantic).not.toHaveBeenCalled();
  });
  it.each([1, 4, '3', null])(
    'rejects unknown or malformed version %p',
    async (version) => {
      await expect(
        negotiateReader(
          bytes({ version }),
          { versions: [2, 3], capabilities: [] },
          semantic,
        ),
      ).rejects.toThrow();
    },
  );
  it.each([
    { version: 2, chapters: [] },
    { ...legacy, manifest: { ...legacy.manifest, authors: [4] } },
    { ...legacy, chapters: [] },
  ])(
    'returns a safe boundary error for malformed legacy data',
    async (value) => {
      await expect(
        negotiateReader(
          bytes(value),
          { versions: [2], capabilities: [] },
          semantic,
        ),
      ).rejects.toThrow('INVALID_CONTRACT');
    },
  );
});
