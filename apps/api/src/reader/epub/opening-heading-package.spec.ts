import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

it('keeps number-plus-title headings with a sparse TOC and untitled front matter', async () => {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
  );
  zip.file(
    'book.opf',
    `<package><manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${[0, 1, 2, 3].map((i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}
    </manifest><spine>${[0, 1, 2, 3].map((i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`,
  );
  zip.file(
    'nav.xhtml',
    '<html><body><nav epub:type="toc"><ol><li><a href="c0.xhtml">Start</a></li></ol></nav></body></html>',
  );
  for (const i of [0, 1, 2]) {
    zip.file(
      `c${i}.xhtml`,
      '<html><body><p>This deliberately long front matter paragraph is ordinary prose, without any heading or chapter title to extract.</p></body></html>',
    );
  }
  zip.file(
    'c3.xhtml',
    '<html><body><h2>1</h2><h2>Wanted: Men Who Love</h2><p>Every female wants to be loved by a male.</p></body></html>',
  );
  const readerPackage = await buildReaderPackageFromEpub({
    authors: ['bell hooks'],
    language: 'en',
    title: 'The Will to Change',
    checksum: 'fixture',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  expect(readerPackage.chapters[3]).toMatchObject({
    label: 'Wanted: Men Who Love',
    title: 'Wanted: Men Who Love',
    spineIndex: 3,
    blocks: [
      { kind: 'heading', text: '1' },
      { kind: 'heading', text: 'Wanted: Men Who Love' },
      { kind: 'paragraph', text: 'Every female wants to be loved by a male.' },
    ],
  });
  expect(readerPackage.toc[3].label).toBe('Wanted: Men Who Love');
  expect(readerPackage.chapters[0].label).toBe(
    '1. This deliberately long front matter paragraph…',
  );
});
