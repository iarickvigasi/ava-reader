import { routePolicy } from './route-policy';
import { config, tariff } from './test-fixtures';
import { openRouterTransport } from './openrouter-transport';

describe('explicit bounded provider timeout', () => {
  afterEach(() => jest.restoreAllMocks());
  it('admits five minutes only when configured without changing reserve', () => {
    const original = routePolicy(config, tariff);
    const extended = routePolicy({ ...config, timeoutMs: 300000 }, tariff);
    expect(extended.config.timeoutMs).toBe(300000);
    expect(extended.maximumNano).toBe(original.maximumNano);
    expect(original.config.timeoutMs).toBe(config.timeoutMs);
  });
  it.each([300001, Infinity, NaN, 299999.5])(
    'refuses invalid timeout %s',
    (timeoutMs) => {
      expect(() => routePolicy({ ...config, timeoutMs }, tariff)).toThrow(
        'PDF_PROVIDER_ROUTE_INVALID',
      );
    },
  );
  it('external authority loss aborts before deadline without a second send', async () => {
    const authority = new AbortController();
    const deadline = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(deadline.signal);
    const send = jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) throw Error('Missing signal');
          signal.addEventListener(
            'abort',
            () => reject(new Error('authority lost')),
            {
              once: true,
            },
          );
        }),
    );
    const response = openRouterTransport({
      request: Buffer.from('{}'),
      apiKey: 'synthetic',
      timeoutMs: 300000,
      maxResponseBytes: 100,
      signal: authority.signal,
    });
    const refused = expect(response).rejects.toThrow('authority lost');
    authority.abort(new Error('authority lost'));
    await refused;
    expect(timeout).toHaveBeenCalledWith(300000);
    expect(deadline.signal.aborted).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
