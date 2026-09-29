import JSZip from 'jszip';
import { hasCanonicalEpubProfile } from './detect-profile';
async function epub(files: Record<string, string>) {
  const zip = new JSZip();
  for (const [path, data] of Object.entries(files)) zip.file(path, data);
  return zip.generateAsync({ type: 'nodebuffer' });
}
describe('generated EPUB recognition', () => {
  it('preserves ordinary EPUB legacy route', async () => {
    expect(
      await hasCanonicalEpubProfile(
        await epub({
          mimetype: 'application/epub+zip',
          'content.opf': '<package/>',
        }),
      ),
    ).toBe(false);
  });
  it.each(['META-INF/ava-profile', 'EPUB/ava-canonical.json'])(
    'claims even malformed declared %s so it cannot fall back',
    async (path) => {
      expect(
        await hasCanonicalEpubProfile(await epub({ [path]: 'broken' })),
      ).toBe(true);
    },
  );
  it('rejects unreadable ZIP input', async () => {
    await expect(
      hasCanonicalEpubProfile(Buffer.from('not a ZIP')),
    ).rejects.toThrow('archive could not be read');
  });
});
