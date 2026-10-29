import { assessPackage } from './assess-package';
import type { ReaderPackage } from '../../reader/reader-types';

function pkg(text = 'Readable classical prose. '.repeat(20)) {
  return {
    manifest: { sourceChecksum: 'checksum' },
    toc: [{}],
    chapters: [
      {
        blocks: Array.from({ length: 5 }, () => ({ kind: 'paragraph', text })),
      },
    ],
  } as ReaderPackage;
}
it('requires actual paragraphs, readable text, navigation, and the exact source', () => {
  expect(assessPackage(pkg(), 'checksum').paragraphs).toBe(5);
  expect(() => assessPackage(pkg(), 'wrong')).toThrow();
  expect(() => assessPackage({ ...pkg(), toc: [] }, 'checksum')).toThrow();
  expect(() => assessPackage(pkg('short'), 'checksum')).toThrow();
  expect(() => assessPackage(pkg('\uFFFD'.repeat(300)), 'checksum')).toThrow();
});
