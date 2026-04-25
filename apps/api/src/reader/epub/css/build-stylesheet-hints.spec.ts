import {
  buildStylesheetHintMap,
  mergeStylesheetClassHints,
} from './build-stylesheet-hints';

describe('buildStylesheetHintMap', () => {
  it('extracts the hints we care about from class and tag rules', () => {
    const map = buildStylesheetHintMap([
      `
        p { text-indent: 1em; }
        .nonindent { text-indent: 0; }
        .indent { text-indent: 1em; }
        .center01 { text-align: center; font-size: 0.85em; }
      `,
    ]);

    expect(map.tagHints.get('p')).toEqual({ textIndent: 1 });
    expect(map.classHints.get('nonindent')).toEqual({ textIndent: 0 });
    expect(map.classHints.get('indent')).toEqual({ textIndent: 1 });
    expect(map.classHints.get('center01')).toEqual({
      align: 'center',
      fontSizeScale: 0.85,
    });
  });

  it('lets later rules override earlier ones (document-order cascade)', () => {
    const map = buildStylesheetHintMap([
      `.foo { text-align: left; font-size: 1em; }`,
      `.foo { text-align: center; }`,
    ]);
    // text-align overridden, font-size kept (not redeclared) — but
    // font-size: 1em is the "no-op" default and gets normalized away
    // by resolveFontSizeScale, so the final hint is just align.
    expect(map.classHints.get('foo')).toEqual({ align: 'center' });
  });

  it("skips properties we don't care about", () => {
    const map = buildStylesheetHintMap([
      `.foo { color: red; margin: 0; line-height: 1.4; }`,
    ]);
    expect(map.classHints.get('foo')).toBeUndefined();
  });
});

describe('mergeStylesheetClassHints', () => {
  it('overlays only set fields', () => {
    const merged = mergeStylesheetClassHints(
      { align: 'left', fontSizeScale: 1.1 },
      { align: 'center' },
    );
    expect(merged).toEqual({
      align: 'center',
      fontSizeScale: 1.1,
      textIndent: undefined,
    });
  });

  it('returns either side when the other is missing', () => {
    expect(mergeStylesheetClassHints(undefined, { align: 'center' })).toEqual({
      align: 'center',
    });
    expect(mergeStylesheetClassHints({ align: 'center' }, undefined)).toEqual({
      align: 'center',
    });
  });
});
