import { selectEpub } from './select-epub';

const epub = {
  name: 'classic.epub',
  size: '1024',
  md5: 'a'.repeat(32),
  format: 'EPUB',
};
const item = {
  metadata: { mediatype: 'texts', collection: ['americana'] },
  files: [epub],
};

describe('Internet Archive file eligibility', () => {
  it('selects the exact unrestricted EPUB, not a PDF or arbitrary file', () => {
    expect(
      selectEpub({ ...item, files: [...item.files, { name: 'scan.pdf' }] }),
    ).toEqual(epub);
    expect(() => selectEpub(item, 'other.epub')).toThrow('found 0');
  });
  it.each([
    { 'access-restricted-item': 'true' },
    { access_restricted: true },
    { collection: ['inlibrary'] },
    { collection: ['printdisabled'] },
  ])('rejects restricted item metadata %j', (restricted) => {
    expect(() =>
      selectEpub({ ...item, metadata: { ...item.metadata, ...restricted } }),
    ).toThrow('Restricted');
  });
  it('rejects encrypted, private, unchecked, or ambiguous files', () => {
    for (const change of [
      { private: 'true' },
      { format: 'LCP encrypted EPUB' },
      { md5: undefined },
      { name: '../bad.epub' },
    ])
      expect(() =>
        selectEpub({ ...item, files: [{ ...epub, ...change }] }),
      ).toThrow();
    expect(() =>
      selectEpub({ ...item, files: [epub, { ...epub, name: 'other.epub' }] }),
    ).toThrow('found 2');
  });
});
