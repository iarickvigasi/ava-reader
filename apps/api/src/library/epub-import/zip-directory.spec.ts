import JSZip from 'jszip';
import { boundEpubDirectory } from './zip-directory';
async function example() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  return zip.generateAsync({ type: 'nodebuffer' });
}
it('bounds a normal directory without inflating entries', async () => {
  expect(() => boundEpubDirectory(Buffer.from('short'))).toThrow();
  expect(() => boundEpubDirectory(Buffer.alloc(0))).toThrow();
  const bytes = await example();
  expect(() => boundEpubDirectory(bytes)).not.toThrow();
});
it('refuses lying count and ZIP64 sentinels before JSZip allocation', async () => {
  const bytes = await example(),
    end = bytes.length - 22;
  for (const count of [0, 24001, 65535]) {
    const changed = Buffer.from(bytes);
    changed.writeUInt16LE(count, end + 8);
    changed.writeUInt16LE(count, end + 10);
    expect(() => boundEpubDirectory(changed)).toThrow();
  }
});
it('refuses a central record whose variable fields leave declared bounds', async () => {
  const bytes = await example(),
    end = bytes.length - 22,
    start = bytes.readUInt32LE(end + 16);
  bytes.writeUInt16LE(65535, start + 28);
  expect(() => boundEpubDirectory(bytes)).toThrow();
});
