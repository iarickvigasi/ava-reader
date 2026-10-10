import JSZip from 'jszip';
import { buildReaderPackageFromEpub } from './epub-reader-package';

// Authored XHTML expectations are independent of converter/exporter code.
export const ORDINARY_FIGURE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a99kAAAAASUVORK5CYII=',
  'base64',
);
const XHTML = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en"><head><link rel="stylesheet" href="style.css"/></head><body><section id="wrapper"><h1 id="opening">The Lantern Atlas</h1>
<p id="opening-prose">Mira carried a lantern to the harbour before dawn.</p>
<blockquote>Keep the light steady.<p class="normal" id="upright">This line is upright and begins without an indent.</p></blockquote>
<p id="inline">A <strong>bold <span style="font-weight:400;font-style:normal;font-variant:normal">reset</span></strong>, <span style="font-variant:small-caps">small capitals</span>, H<sub>2</sub>O and m<sup>2</sup>.</p>
<figure id="figure"><img id="art" src="window.png" alt="One window"/><figcaption id="caption">Figure 1. One window.</figcaption></figure>
<ol id="list" start="3"><li id="first-item">Pack the lantern.<ol id="nested" type="a" start="2"><li id="nested-item">Check the wick.</li><li>Keep the spare match dry.</li></ol></li><li>Fold the map.</li></ol>
<table id="table"><caption id="table-caption">The lamp register</caption><thead><tr><th id="place" scope="col">Place</th><th id="count" scope="col">Lamps</th></tr></thead><tbody><tr><th id="harbour" scope="row">Harbour</th><td id="four" headers="harbour count">4</td></tr><tr><td rowspan="2">Workshop</td><td>2</td></tr><tr><td>3</td></tr></tbody></table>
<p id="poem" class="verse">One light above the water,
One shadow on the foam,
Four windows guide us home.</p><pre id="code">lamp = 4
if lamp &gt; 0:
    print(&quot;home&quot;)</pre><aside id="aside" xml:lang="uk">Майстерня — це частина книжки.</aside>
<p id="register" class="index">North quay, lanterns
    first watch, 3
    return journey, 7</p><span id="empty-before"/><p id="after-empty">The last light stayed steady.</p><span id="empty-end"/></section></body></html>`;
const CSS = `blockquote {font-style:italic;font-weight:700;} blockquote .normal {font-style:normal;font-weight:normal;text-indent:0;} .verse,.index {white-space:pre-wrap;} .normal {font-variant:normal;} figure {text-align:center;}`;
export async function ordinaryProfilePackage() {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>',
  );
  zip.file(
    'OEBPS/book.opf',
    '<package><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
  );
  zip.file('OEBPS/chapter.xhtml', XHTML);
  zip.file('OEBPS/style.css', CSS);
  zip.file('OEBPS/window.png', ORDINARY_FIGURE_BYTES);
  return buildReaderPackageFromEpub({
    authors: ['Fixture Studio'],
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    checksum: 'ordinary-fixture',
    language: 'en',
    title: 'The Lantern Atlas',
  });
}
