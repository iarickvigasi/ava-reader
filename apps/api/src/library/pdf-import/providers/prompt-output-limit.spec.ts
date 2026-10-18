import { prepareProviderRequest } from './prepare-request';
import { routePolicy } from './route-policy';
import { route, task, config, tariff } from './test-fixtures';
import { tokenCost, usdToNano } from './money';
const mapped = (limit: number) => ({
  ...config,
  maxOutputTokensByPrompt: { [task.promptVersion]: limit },
});
it('keeps unaffected request bytes and reservation exact when a larger route opts into prompt limits', () => {
  const old = prepareProviderRequest(
    { ...route, configuration: { ...config, maxOutputTokens: 16384 } },
    task,
  );
  const next = prepareProviderRequest(
    { ...route, configuration: mapped(16384) },
    task,
  );
  expect(next.request.equals(old.request)).toBe(true);
  expect(next.maximumNano).toBe(old.maximumNano);
  expect(next.taskSha256).toBe(old.taskSha256);
});
it('gives only the opted-in prompt its configured capacity and reserves the exact difference', () => {
  const low = prepareProviderRequest(
    { ...route, configuration: mapped(16384) },
    task,
  );
  const high = prepareProviderRequest(
    { ...route, configuration: mapped(32768) },
    task,
  );
  expect(
    (JSON.parse(high.request.toString()) as { max_tokens: number }).max_tokens,
  ).toBe(32768);
  expect(high.maximumNano - low.maximumNano).toBe(
    tokenCost(usdToNano(tariff.completionPerMillionUsd), 16384),
  );
});
it('honors a smaller explicit task bound under its prompt ceiling', () => {
  const p = prepareProviderRequest(
    { ...route, configuration: mapped(8192) },
    { ...task, maxOutputTokens: 3072 },
  );
  expect(
    (JSON.parse(p.request.toString()) as { max_tokens: number }).max_tokens,
  ).toBe(3072);
});
it('rejects an explicit task bound above its prompt ceiling before dispatch', () => {
  expect(() =>
    prepareProviderRequest(
      { ...route, configuration: mapped(8192) },
      { ...task, maxOutputTokens: 8193 },
    ),
  ).toThrow('PDF_PROVIDER_REQUEST_LIMIT');
});
it('retains legacy global default for an unmapped prompt', () => {
  const p = prepareProviderRequest(
    { ...route, configuration: { ...config, maxOutputTokensByPrompt: {} } },
    task,
  );
  expect(p.request.equals(prepareProviderRequest(route, task).request)).toBe(
    true,
  );
});
it.each([0, -1, 0.5, NaN, Infinity, 32769, 65537])(
  'rejects invalid per-prompt cap %s',
  (cap) => {
    expect(() => routePolicy(mapped(cap), tariff)).toThrow(
      'PDF_PROVIDER_ROUTE_INVALID',
    );
  },
);
it('rejects unknown prompt keys rather than silently ignoring a limit', () => {
  expect(() =>
    routePolicy(
      { ...config, maxOutputTokensByPrompt: { unknown: 4096 } },
      tariff,
    ),
  ).toThrow('PDF_PROVIDER_ROUTE_INVALID');
});
it('rejects oversized prompt keys', () => {
  expect(() =>
    routePolicy(
      { ...config, maxOutputTokensByPrompt: { ['x'.repeat(101)]: 4096 } },
      tariff,
    ),
  ).toThrow('PDF_PROVIDER_ROUTE_INVALID');
});

it('never treats inherited object properties as prompt limits', () => {
  const inheritedTask = { ...task, promptVersion: 'toString' };
  const c = {
    ...config,
    promptHashes: { toString: config.promptHashes['prompt-1'] },
    maxOutputTokensByPrompt: {},
  };
  const p = prepareProviderRequest(
    { ...route, configuration: c },
    inheritedTask,
  );
  expect(
    (JSON.parse(p.request.toString()) as { max_tokens: number }).max_tokens,
  ).toBe(config.maxOutputTokens);
});
