import {
  resolveTextIndentFromStyle,
  resolveTextIndentValue,
} from './text-indent';

describe('resolveTextIndentFromStyle', () => {
  it('parses em / rem / % / ch', () => {
    expect(resolveTextIndentFromStyle('text-indent: 1em')).toBe(1);
    expect(resolveTextIndentFromStyle('text-indent: 1.5rem')).toBe(1.5);
    expect(resolveTextIndentFromStyle('text-indent: 100%')).toBe(1);
    expect(resolveTextIndentFromStyle('text-indent: 2ch')).toBe(1);
  });

  it('treats 0 as no-indent', () => {
    expect(resolveTextIndentFromStyle('text-indent: 0')).toBe(0);
    expect(resolveTextIndentFromStyle('text-indent: 0em')).toBe(0);
    expect(resolveTextIndentFromStyle('text-indent: 0%')).toBe(0);
  });

  it('drops absolute and unparseable units', () => {
    expect(resolveTextIndentFromStyle('text-indent: 30px')).toBeNull();
    expect(resolveTextIndentFromStyle('text-indent: 12pt')).toBeNull();
    expect(resolveTextIndentFromStyle('text-indent: inherit')).toBeNull();
  });

  it('returns null when style has no text-indent', () => {
    expect(resolveTextIndentFromStyle(undefined)).toBeNull();
    expect(resolveTextIndentFromStyle('')).toBeNull();
    expect(resolveTextIndentFromStyle('color: red')).toBeNull();
  });

  it('rejects negative indents (we render LTR-only book content)', () => {
    expect(resolveTextIndentValue('-1em')).toBeNull();
  });

  it('clamps absurd values', () => {
    expect(resolveTextIndentValue('20em')).toBe(4);
  });
});
