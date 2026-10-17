import { prepareProviderRequest } from './prepare-request';
import { parseProviderReceipt } from './receipt';
import { route, task, response } from './test-fixtures';
describe('provider request and receipt boundary', () => {
  it('pins provider, output, strict schema, privacy and prices', () => {
    const p = prepareProviderRequest(route, task),
      body = JSON.parse(p.request.toString()) as {
        provider: unknown;
        response_format: { json_schema: { strict: boolean } };
        max_tokens: number;
      };
    expect(body.provider).toMatchObject({
      only: ['alibaba'],
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: 'deny',
    });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.max_tokens).toBe(32768);
    expect(
      prepareProviderRequest(route, structuredClone(task)).requestSha256,
    ).toBe(p.requestSha256);
  });
  it('refuses changed prompt/schema and remote image URLs', () => {
    const changed = structuredClone(task);
    changed.messages[0].content = 'Summarize';
    expect(() => prepareProviderRequest(route, changed)).toThrow();
    expect(() =>
      prepareProviderRequest(route, { ...task, responseSchema: {} }),
    ).toThrow();
    changed.messages[0] = task.messages[0];
    changed.messages[1].content = [
      { type: 'image_url', image_url: { url: 'https://private.invalid' } },
    ];
    expect(() => prepareProviderRequest(route, changed)).toThrow();
  });
  it('settlement parses exact model and charged cost', () =>
    expect(parseProviderReceipt(response(), route.modelId)).toMatchObject({
      actualNano: 1000000n,
      complete: true,
    }));
  it('retains known cost when content shape is malformed', () =>
    expect(
      parseProviderReceipt(response('0.001', { choices: [] }), route.modelId),
    ).toMatchObject({ actualNano: 1000000n, complete: false, output: null }));
  it('rejects invalid UTF8, missing costs and wrong model', () => {
    expect(() =>
      parseProviderReceipt(Buffer.from([255]), route.modelId),
    ).toThrow();
    expect(() =>
      parseProviderReceipt(response(undefined, { usage: {} }), route.modelId),
    ).toThrow();
    expect(() => parseProviderReceipt(response(), 'other/model')).toThrow();
  });
  it('recognizes truncated output while retaining known charge', () =>
    expect(
      parseProviderReceipt(
        response('0.001', {
          choices: [
            { finish_reason: 'length', message: { content: 'partial' } },
          ],
        }),
        route.modelId,
      ),
    ).toMatchObject({ actualNano: 1000000n, complete: false }));
});
