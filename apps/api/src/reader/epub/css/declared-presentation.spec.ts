import { declaredPresentation } from './declared-presentation';

describe('finite CSS declaration validation', () => {
  it('does not invent tokens for unknown, unsafe or out-of-range declarations', () => {
    expect(
      declaredPresentation({
        'font-family': 'PrivateFont',
        'font-size': '99em',
        'margin-top': '-1em',
        'line-height': 'url(x)',
        color: 'var(--color)',
        'background-color': 'url(https://example.test)',
        'text-decoration-line': 'overline',
      }),
    ).toEqual({ id: 'epub-presentation' });
  });
  it('retains negative first-line indentation and explicit spacing/decoration resets', () => {
    expect(
      declaredPresentation({
        'text-indent': '-2em',
        'margin-inline-start': '0em',
        'margin-top': '0em',
        'margin-bottom': '0em',
        'text-decoration-line': 'none',
      }),
    ).toMatchObject({
      indent_em: -2,
      block_indent_em: 0,
      space_before_em: 0,
      space_after_em: 0,
      underline: false,
      strike_through: false,
    });
  });
});
