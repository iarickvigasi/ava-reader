import { cacheLanguageDecision } from './decision-cache';

it('expires decisions and bounds the cache', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(0);
  const load = jest.fn(() => Promise.resolve('fr'));
  await cacheLanguageDecision('expiry-test', load);
  await cacheLanguageDecision('expiry-test', load);
  expect(load).toHaveBeenCalledTimes(1);
  now.mockReturnValue(600_001);
  await cacheLanguageDecision('expiry-test', load);
  expect(load).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 256; i++) await cacheLanguageDecision(`evict-${i}`, load);
  await cacheLanguageDecision('expiry-test', load);
  expect(load).toHaveBeenCalledTimes(259);
  now.mockRestore();
});
