import {
  resolveFontWeightFromStyle,
  resolveFontWeightValue,
} from './font-weight';

describe('resolveFontWeightFromStyle', () => {
  it('parses numeric weights', () => {
    expect(resolveFontWeightFromStyle('font-weight: 100')).toBe(100);
    expect(resolveFontWeightFromStyle('font-weight: 500')).toBe(500);
    expect(resolveFontWeightFromStyle('font-weight: 700')).toBe(700);
    expect(resolveFontWeightFromStyle('font-weight: 900')).toBe(900);
  });

  it('parses keywords', () => {
    expect(resolveFontWeightFromStyle('font-weight: bold')).toBe(700);
    expect(resolveFontWeightFromStyle('font-weight: bolder')).toBe(700);
    expect(resolveFontWeightFromStyle('font-weight: lighter')).toBe(300);
  });

  it('treats normal/400 (the default) as unset', () => {
    expect(resolveFontWeightFromStyle('font-weight: normal')).toBeNull();
    expect(resolveFontWeightFromStyle('font-weight: 400')).toBeNull();
  });

  it('rounds to the nearest 100 bucket', () => {
    expect(resolveFontWeightValue('510')).toBe(500);
    expect(resolveFontWeightValue('560')).toBe(600);
  });

  it('clamps out-of-range values', () => {
    expect(resolveFontWeightValue('50')).toBe(100);
    expect(resolveFontWeightValue('1500')).toBe(900);
  });

  it('returns null for missing or unparseable input', () => {
    expect(resolveFontWeightFromStyle(undefined)).toBeNull();
    expect(resolveFontWeightFromStyle('')).toBeNull();
    expect(resolveFontWeightFromStyle('color: red')).toBeNull();
    expect(resolveFontWeightValue('inherit')).toBeNull();
    expect(resolveFontWeightValue('whatever')).toBeNull();
  });

  it('finds font-weight among other declarations', () => {
    expect(
      resolveFontWeightFromStyle('color: red; font-weight: 600; margin: 0'),
    ).toBe(600);
  });
});
