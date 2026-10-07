import JSZip from 'jszip';
import { setup } from './edge.fixture';
import { readSourceSections } from '../../reader/epub/edge-grouping/read-source-sections';

it('uses authored TOC labels and footnote semantics from the EPUB archive', async () => {
  const { pkg } = setup(['front', 'contents', 'footnote', 'unknown']);
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
  );
  zip.file(
    'OPS/book.opf',
    '<package><manifest><item id="nav" href="nav.xhtml" properties="nav"/></manifest></package>',
  );
  // EPUB extensions and ZIP-local hrefs are not resolvable by the IDE's HTML inspection.
  //noinspection HtmlUnknownAttribute,HtmlUnknownTarget
  zip.file(
    'OPS/nav.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en"><body><nav epub:type="toc"><ol><li><a href="c0.xhtml">Copyright</a></li><li><a href="c1.xhtml">Contents</a></li></ol></nav></body></html>',
  );
  zip.file(
    'OPS/c0.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><body><p>All rights reserved.</p></body></html>',
  );
  zip.file(
    'OPS/c1.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><body><p>Contents</p></body></html>',
  );
  zip.file(
    'OPS/c2.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><body><aside role="doc-footnote"><p>Note text.</p></aside></body></html>',
  );
  zip.file(
    'OPS/c3.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><body><p>Short story.</p></body></html>',
  );
  const sections = await readSourceSections(
    await zip.generateAsync({ type: 'nodebuffer' }),
    pkg,
  );
  expect([...sections.values()].map((s) => s.role)).toEqual([
    'front',
    'contents',
    'footnote',
    'unknown',
  ]);
});
