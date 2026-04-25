import { parseStylesheet } from './parse-stylesheet';

describe('parseStylesheet', () => {
  it('extracts simple class rules', () => {
    const rules = parseStylesheet(`
      .indent { text-indent: 1em; }
      .nonindent { text-indent: 0; }
      .center01 { text-align: center; font-size: 0.85em; }
    `);

    expect(rules).toHaveLength(3);
    expect(rules[0]).toEqual({
      selectors: [{ kind: 'class', className: 'indent' }],
      declarations: { 'text-indent': '1em' },
    });
    expect(rules[2]).toEqual({
      selectors: [{ kind: 'class', className: 'center01' }],
      declarations: {
        'text-align': 'center',
        'font-size': '0.85em',
      },
    });
  });

  it('handles tag and tag.class selectors', () => {
    const rules = parseStylesheet(`
      p { text-indent: 1em; }
      p.indent { text-indent: 1.5em; }
    `);

    expect(rules[0].selectors).toEqual([{ kind: 'tag', tagName: 'p' }]);
    // tag.class is collapsed to the class portion.
    expect(rules[1].selectors).toEqual([
      { kind: 'class', className: 'indent' },
    ]);
  });

  it('expands comma-separated selector lists', () => {
    const rules = parseStylesheet(`.a, .b, p { color: red; }`);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual([
      { kind: 'class', className: 'a' },
      { kind: 'class', className: 'b' },
      { kind: 'tag', tagName: 'p' },
    ]);
  });

  it('drops rules whose selectors are all complex', () => {
    const rules = parseStylesheet(`
      .foo .bar { color: red; }
      .foo > p { color: red; }
      a:hover { color: red; }
      [data-x="y"] { color: red; }
      .foo.bar { color: red; }
    `);
    expect(rules).toHaveLength(0);
  });

  it('keeps the simple selector when a comma list mixes simple and complex', () => {
    const rules = parseStylesheet(`.foo, .bar > p { color: red; }`);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual([
      { kind: 'class', className: 'foo' },
    ]);
  });

  it('ignores comments', () => {
    const rules = parseStylesheet(`
      /* Block comment with { braces } inside */
      .foo { color: red; /* inline */ font-size: 1em; }
    `);
    expect(rules).toHaveLength(1);
    expect(rules[0].declarations).toEqual({
      color: 'red',
      'font-size': '1em',
    });
  });

  it('strips !important from values', () => {
    const rules = parseStylesheet(`.foo { text-align: center !important; }`);
    expect(rules[0].declarations).toEqual({ 'text-align': 'center' });
  });

  it('picks up rules nested inside @media blocks', () => {
    // We don't honour the media query (we always apply), but we also
    // shouldn't drop the rule entirely.
    const rules = parseStylesheet(`
      @media (min-width: 600px) {
        .wide { font-size: 1.2em; }
      }
    `);
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual([
      { kind: 'class', className: 'wide' },
    ]);
  });

  it('returns an empty list for empty / blank input', () => {
    expect(parseStylesheet('')).toEqual([]);
    expect(parseStylesheet('   \n\t  ')).toEqual([]);
  });
});
