import { classifyDocument } from './classify-document';
import { locatorIsAffected } from './locator-is-affected';

it('recognizes semantic footnotes without relying on filenames or length', () => {
  // EPUB attributes are valid XML extensions, outside the IDE's HTML schema.
  //noinspection HtmlUnknownAttribute
  expect(
    classifyDocument(
      '<body xmlns:epub="http://www.idpf.org/2007/ops"><div epub:type="footnote"><p>A long note.</p></div></body>',
      [],
    ).role,
  ).toBe('footnote');
  expect(
    classifyDocument(
      '<body><p>A story.</p><aside role="doc-footnote">Note</aside></body>',
      [],
    ).role,
  ).toBe('unknown');
});
it('keeps contents, introductions, and tiny prose separate', () => {
  expect(classifyDocument('<body><p>Text</p></body>', ['Contents']).role).toBe(
    'contents',
  );
  expect(
    classifyDocument('<body><p>Text</p></body>', ['Introduction']).role,
  ).toBe('unknown');
  expect(classifyDocument('<body><p>Hi.</p></body>', []).role).toBe('unknown');
  //noinspection HtmlUnknownAttribute
  expect(
    classifyDocument(
      '<body xmlns:epub="http://www.idpf.org/2007/ops" epub:type="dedication"><p>To you.</p></body>',
      [],
    ).role,
  ).toBe('front');
});
it('detects nested saved locations and fails closed on malformed JSON', () => {
  const removed = new Set(['old']);
  expect(locatorIsAffected('{"start":{"chapterId":"old"}}', removed)).toBe(
    true,
  );
  expect(locatorIsAffected('{"chapterId":"body","text":"old"}', removed)).toBe(
    false,
  );
  expect(() => locatorIsAffected('bad-json', removed)).toThrow();
});

it('does not mistake an epigraph embedded in a story for front matter', () => {
  //noinspection HtmlUnknownAttribute
  expect(
    classifyDocument(
      '<body xmlns:epub="http://www.idpf.org/2007/ops"><aside epub:type="epigraph">Quotation</aside><p>Story</p></body>',
      [],
    ).role,
  ).toBe('unknown');
});

it('never absorbs a shared contents destination into front matter', () => {
  expect(
    classifyDocument('<body><p>Text</p></body>', ['Copyright', 'Contents'])
      .role,
  ).toBe('contents');
});
