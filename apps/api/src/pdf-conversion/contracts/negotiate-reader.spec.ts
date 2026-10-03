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
