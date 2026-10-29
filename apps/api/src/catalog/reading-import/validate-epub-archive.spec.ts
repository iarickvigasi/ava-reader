import JSZip from 'jszip';
import { validateEpubArchive } from './validate-epub-archive';

async function epub(
  extra?: (zip: JSZip) => void,
  compression: 'STORE' | 'DEFLATE' = 'DEFLATE',
) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container/>');
  extra?.(zip);
  return zip.generateAsync({ type: 'nodebuffer', compression });
}

it('accepts a bounded EPUB archive', async () => {
  await expect(validateEpubArchive(await epub())).resolves.toBeUndefined();
});
it('rejects encrypted, corrupt, and traversal archives before processing', async () => {
  await expect(
    validateEpubArchive(
      await epub((zip) => zip.file('META-INF/encryption.xml', '<encrypted/>')),
    ),
  ).rejects.toThrow();
  await expect(validateEpubArchive(Buffer.from('bad'))).rejects.toThrow();
  await expect(
    validateEpubArchive(
      await epub((zip) => zip.file('../outside.xhtml', 'text')),
    ),
  ).rejects.toThrow();
});
it('rejects an oversized archive entry', async () => {
  const bytes = await epub(
    (zip) => zip.file('large.xhtml', 'a'.repeat(33 * 1024 * 1024)),
    'STORE',
  );
  await expect(validateEpubArchive(bytes)).rejects.toThrow('oversized');
});
