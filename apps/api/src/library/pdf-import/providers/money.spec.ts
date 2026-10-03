import { usdToNano, tokenCost, nanoValue } from './money';
import { routePolicy } from './route-policy';
import { config, tariff } from './test-fixtures';
describe('integer provider accounting', () => {
  test.each([
    ['0', 0n],
    ['0.244707944', 244707944n],
    ['1e-10', 1n],
    ['1.2345678901', 1234567891n],
    ['1e1', 10000000000n],
  ])('%s rounds upward', (v, want) => expect(usdToNano(v)).toBe(want));
  test.each([-1, NaN, Infinity, '-0.01', '10USD', '1e99', null, {}, ''])(
    'rejects invalid cost %s',
    (value) =>
      expect(() => usdToNano(value)).toThrow('PDF_PROVIDER_COST_INVALID'),
  );
  it('bounds integer ledgers', () => {
    expect(nanoValue('10000000000')).toBe(10000000000n);
    expect(() => nanoValue('1.0')).toThrow();
  });
  it('reserves full context including image tokens and maximum output', () =>
    expect(routePolicy(config, tariff).maximumNano).toBe(27262976n));
  it('rounds fractional token charge up', () =>
    expect(tokenCost(1n, 1)).toBe(1n));
  it('refuses incomplete or zero tariff', () => {
    expect(() =>
      routePolicy({ ...config, maxOutputTokens: 150000 }, tariff),
    ).toThrow();
    expect(() =>
      routePolicy(config, {
        ...tariff,
        promptPerMillionUsd: '0',
        completionPerMillionUsd: '0',
      }),
    ).toThrow();
  });
});
