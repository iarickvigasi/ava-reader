import {
  resolveFontSizeScale,
  resolveFontSizeScaleFromStyle,
} from './font-size';

describe('resolveFontSizeScaleFromStyle', () => {
  it('returns null when style is empty or missing a font-size', () => {
    expect(resolveFontSizeScaleFromStyle(undefined)).toBeNull();
    expect(resolveFontSizeScaleFromStyle('')).toBeNull();
    expect(resolveFontSizeScaleFromStyle('color: red; margin: 0')).toBeNull();
  });

  it('parses em / rem / % declarations', () => {
    expect(resolveFontSizeScaleFromStyle('font-size: 0.85em')).toBe(0.85);
    expect(resolveFontSizeScaleFromStyle('font-size: 1.2rem')).toBe(1.2);
    expect(resolveFontSizeScaleFromStyle('font-size: 90%')).toBe(0.9);
  });

  it('parses CSS keyword sizes', () => {
    expect(resolveFontSizeScaleFromStyle('font-size: smaller')).toBe(0.85);
    expect(resolveFontSizeScaleFromStyle('font-size: x-small')).toBe(0.75);
    expect(resolveFontSizeScaleFromStyle('font-size: large')).toBe(1.125);
  });

  it('finds font-size among other declarations', () => {
    expect(
      resolveFontSizeScaleFromStyle(
        'color: red; font-size: 0.8em; line-height: 1.4',
      ),
    ).toBe(0.8);
    expect(resolveFontSizeScaleFromStyle('FONT-SIZE: 75%; color: blue')).toBe(
      0.75,
    );
  });

  it('drops absolute pixel/point sizes — we have no reliable base', () => {
    expect(resolveFontSizeScaleFromStyle('font-size: 14px')).toBeNull();
    expect(resolveFontSizeScaleFromStyle('font-size: 11pt')).toBeNull();
  });

  it('treats 1.0 (the default) as unset', () => {
    expect(resolveFontSizeScaleFromStyle('font-size: 1em')).toBeNull();
    expect(resolveFontSizeScaleFromStyle('font-size: 100%')).toBeNull();
    expect(resolveFontSizeScale('medium')).toBeNull();
  });

  it('clamps extreme values into a sane range', () => {
    expect(resolveFontSizeScale('0.1em')).toBe(0.5);
    expect(resolveFontSizeScale('5em')).toBe(2);
    expect(resolveFontSizeScale('-2em')).toBeNull();
  });

  it('rejects unparseable inputs', () => {
    expect(resolveFontSizeScale('inherit')).toBeNull();
    expect(resolveFontSizeScale('initial')).toBeNull();
    expect(resolveFontSizeScale('whatever')).toBeNull();
    expect(resolveFontSizeScale('')).toBeNull();
  });
});
