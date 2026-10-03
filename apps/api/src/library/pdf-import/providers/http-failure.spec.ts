import { openRouterTransport } from './openrouter-transport';
import {
  privateTransportReceipt,
  providerFailureDiagnostic,
} from './transport-failure';
const input = {
  request: Buffer.from('{}'),
  apiKey: 'secret-for-test',
  timeoutMs: 300000,
  maxResponseBytes: 1024,
};
describe('private non-success transport evidence', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([400, 429])(
    'retains %s privately without assuming zero charge',
    async (status) => {
      const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('{"error":"unsupported anyOf secret-for-test"}', {
          status,
        }),
      );
      const error: unknown = await openRouterTransport(input).catch(
        (e: unknown) => e,
      );
      expect(error).toMatchObject({ code: 'PDF_PROVIDER_TRANSPORT_UNCERTAIN' });
      expect(JSON.stringify(error)).not.toContain('anyOf');
      expect(JSON.stringify(error)).not.toContain(input.apiKey);
      const bytes = privateTransportReceipt(error);
      expect(bytes?.toString()).not.toContain(input.apiKey);
      expect(JSON.parse(bytes!.toString())).toMatchObject({
        status,
        completeness: 'complete',
        body: '{"error":"unsupported anyOf [REDACTED]"}',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('captures retry hints privately and returns only safe machine diagnostics', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: input.apiKey,
            metadata: { limit_source: 'upstream_provider_shared_pool' },
          },
        }),
        { status: 429, headers: { 'Retry-After': '60' } },
      ),
    );
    const error: unknown = await openRouterTransport(input).catch(
      (e: unknown) => e,
    );
    expect(providerFailureDiagnostic(error)).toEqual({
      httpStatus: 429,
      complete: true,
      classification: 'RATE_LIMIT',
      limitSource: 'upstream_provider_shared_pool',
      retryAfterSeconds: 60,
    });
    expect(JSON.stringify(error)).not.toContain('RATE_LIMIT');
    expect(privateTransportReceipt(error)?.toString()).not.toContain(
      input.apiKey,
    );
  });
  it('caps body evidence and cancels excess without a second send', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(2000).fill(65));
      },
      cancel,
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(body, { status: 400 }));
    const error: unknown = await openRouterTransport(input).catch(
      (e: unknown) => e,
    );
    const receipt = JSON.parse(privateTransportReceipt(error)!.toString()) as {
      completeness: string;
      captured_bytes: number;
      body: string;
    };
    expect(receipt).toMatchObject({
      completeness: 'body_limit',
      captured_bytes: 1024,
    });
    expect(receipt.body.length).toBe(1024);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('retains known status after a body abort without classifying billing', async () => {
    const authority = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(Buffer.from('partial reason'));
        authority.signal.addEventListener('abort', () =>
          c.error(authority.signal.reason),
        );
      },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(body, { status: 429 }));
    const pending = openRouterTransport({ ...input, signal: authority.signal });
    await Promise.resolve();
    authority.abort(new Error('lease lost'));
    const error: unknown = await pending.catch((e: unknown) => e);
    expect(
      JSON.parse(privateTransportReceipt(error)!.toString()),
    ).toMatchObject({
      status: 429,
      completeness: 'body_unavailable',
    });
  });
});
