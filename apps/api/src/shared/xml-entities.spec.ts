import { XMLParser } from 'fast-xml-parser';
import { createXmlEntityDecoder, decodeXmlEntities } from './xml-entities';

describe('EPUB entity decoding', () => {
  const decoder = createXmlEntityDecoder();

  it.each([
    ['1&nbsp;Ist Lieben eine Kunst?', '1\u00a0Ist Lieben eine Kunst?'],
    ['&ldquo;Caf&eacute;&rdquo;&mdash;&hellip;', '“Café”—…'],
    ['&ensp;&emsp;&thinsp;', '\u2002\u2003\u2009'],
    ['&NotEqualTilde;', '\u2242\u0338'],
    ['&CounterClockwiseContourIntegral;', '\u2233'],
    ['&amp;&apos;&gt;&lt;&quot;', '&\'><"'],
    ['&#160; &#xA0; &#X1F600;', '\u00a0 \u00a0 😀'],
    ['&#128;', '\u0080'],
    ['&amp;nbsp; &amp;#160;', '&nbsp; &#160;'],
    [
      '&unknown; &constructor; &toString;',
      '&unknown; &constructor; &toString;',
    ],
    ['&nbsp &notAnEntity; &#xZZ; &#-1;', '&nbsp &notAnEntity; &#xZZ; &#-1;'],
    ['&#0; &#xD800; &#x110000;', '&#0; &#xD800; &#x110000;'],
  ])('decodes %s in one pass', (source, expected) => {
    expect(decoder.decode(source)).toBe(expected);
  });

  it('preserves entity declaration precedence and resets document entities', () => {
    const declaredDecoder = createXmlEntityDecoder();
    declaredDecoder.setExternalEntities({ label: 'External', nbsp: 'Space' });
    declaredDecoder.addInputEntities({ label: 'Document' });

    expect(declaredDecoder.decode('&label; &nbsp;')).toBe('Document Space');
    declaredDecoder.reset();
    expect(declaredDecoder.decode('&label; &nbsp;')).toBe('External Space');
    declaredDecoder.setExternalEntities({});
    expect(declaredDecoder.decode('&label; &nbsp;')).toBe('&label; \u00a0');
  });

  it('keeps document declarations local to each XML parse and CDATA literal', () => {
    const parser = new XMLParser({ entityDecoder: createXmlEntityDecoder() });
    // The parser resolves this document-scoped entity declaration at runtime.
    //noinspection CheckDtdRefs
    expect(
      parser.parse(
        '<!DOCTYPE p [<!ENTITY label "Chapter">]><p>&label;&nbsp;1</p>',
      ),
    ).toEqual({ p: 'Chapter\u00a01' });
    // This second document deliberately has no declaration for label.
    //noinspection CheckDtdRefs
    expect(parser.parse('<p>&label;&nbsp;2</p>')).toEqual({
      p: '&label;\u00a02',
    });
    expect(parser.parse('<p><![CDATA[&nbsp;]]></p>')).toEqual({ p: '&nbsp;' });
  });
});

describe('legacy stored display text', () => {
  it('retains the existing XML-only decoding rules', () => {
    expect(decodeXmlEntities('&nbsp; &ldquo; &eacute;')).toBe(
      '&nbsp; &ldquo; &eacute;',
    );
    expect(decodeXmlEntities('&amp; &#8217; &#x201C;')).toBe('& ’ “');
  });
});
