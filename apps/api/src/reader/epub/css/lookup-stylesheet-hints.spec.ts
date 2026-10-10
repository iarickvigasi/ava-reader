import { buildStylesheetHintMap } from './build-stylesheet-hints';
import { lookupStylesheetHints } from './lookup-stylesheet-hints';

describe('bounded EPUB selector precedence', () => {
  it('lets a class reset beat lower-specificity descendant tags, regardless of order', () => {
    for (const css of [
      'blockquote p {font-style:italic;font-size:80%;text-indent:2em} .plain {font-style:normal;font-size:100%;text-indent:0}',
      '.plain {font-style:normal;font-size:100%;text-indent:0} blockquote p {font-style:italic;font-size:80%;text-indent:2em}',
    ]) {
      const hints = lookupStylesheetHints(
        'p',
        { '@_class': 'plain' },
        buildStylesheetHintMap([css]),
        [{ tagName: 'blockquote', classNames: [] }],
      );
      expect(hints).toMatchObject({
        fontSizeScale: 1,
        textIndent: 0,
        presentation: { italic: false },
      });
    }
  });
  it('uses stylesheet source order rather than HTML class attribute order for equal specificity', () => {
    const map = buildStylesheetHintMap([
      '.first {font-style:italic}',
      '.second {font-style:normal}',
    ]);
    for (const className of ['first second', 'second first'])
      expect(
        lookupStylesheetHints('p', { '@_class': className }, map),
      ).toMatchObject({ presentation: { italic: false } });
  });
  it('matches the tag component of tag.class and honors its higher specificity', () => {
    const map = buildStylesheetHintMap([
      'p.plain {font-style:normal} .plain {font-style:italic}',
    ]);
    expect(
      lookupStylesheetHints('p', { '@_class': 'plain' }, map),
    ).toMatchObject({ presentation: { italic: false } });
    expect(
      lookupStylesheetHints('div', { '@_class': 'plain' }, map),
    ).toMatchObject({ presentation: { italic: true } });
  });
  it('honors higher-specificity descendant classes only within their ancestry', () => {
    const map = buildStylesheetHintMap([
      '.quote .plain {font-style:italic} .plain {font-style:normal}',
    ]);
    expect(
      lookupStylesheetHints('p', { '@_class': 'plain' }, map, [
        { tagName: 'div', classNames: ['quote'] },
      ]),
    ).toMatchObject({ presentation: { italic: true } });
    expect(
      lookupStylesheetHints('p', { '@_class': 'plain' }, map, [
        { tagName: 'div', classNames: [] },
      ]),
    ).toMatchObject({ presentation: { italic: false } });
  });
});
