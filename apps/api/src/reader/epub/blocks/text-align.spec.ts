import {
  resolveTextAlignFromAttrs,
  resolveTextAlignFromStyle,
} from './text-align';

describe('resolveTextAlignFromStyle', () => {
  it('parses left/center/right/justify', () => {
    expect(resolveTextAlignFromStyle('text-align: center')).toBe('center');
    expect(resolveTextAlignFromStyle('text-align: right')).toBe('right');
    expect(resolveTextAlignFromStyle('text-align: justify')).toBe('justify');
    expect(resolveTextAlignFromStyle('text-align: left')).toBe('left');
  });

  it('maps logical CSS values to physical (LTR)', () => {
    expect(resolveTextAlignFromStyle('text-align: start')).toBe('left');
    expect(resolveTextAlignFromStyle('text-align: end')).toBe('right');
  });

  it('finds text-align among other declarations and is case-insensitive', () => {
    expect(
      resolveTextAlignFromStyle('color: red; text-align: CENTER; margin: 0'),
    ).toBe('center');
  });

  it('returns null for missing or unrecognised values', () => {
    expect(resolveTextAlignFromStyle(undefined)).toBeNull();
    expect(resolveTextAlignFromStyle('')).toBeNull();
    expect(resolveTextAlignFromStyle('color: red')).toBeNull();
    expect(resolveTextAlignFromStyle('text-align: inherit')).toBeNull();
    expect(resolveTextAlignFromStyle('text-align: nonsense')).toBeNull();
  });
});

describe('resolveTextAlignFromAttrs', () => {
  it('prefers the style attribute when both are present', () => {
    expect(
      resolveTextAlignFromAttrs({
        '@_style': 'text-align: center',
        '@_align': 'right',
      }),
    ).toBe('center');
  });

  it('falls back to the legacy HTML align attribute', () => {
    expect(resolveTextAlignFromAttrs({ '@_align': 'center' })).toBe('center');
    expect(resolveTextAlignFromAttrs({ '@_align': 'JUSTIFY' })).toBe('justify');
  });

  it('returns null when neither attribute supplies a usable value', () => {
    expect(resolveTextAlignFromAttrs({})).toBeNull();
    expect(resolveTextAlignFromAttrs({ '@_align': 'middle' })).toBeNull();
  });
});
