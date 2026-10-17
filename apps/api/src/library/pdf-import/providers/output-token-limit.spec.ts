import { prepareProviderRequest } from './prepare-request';
import { tokenCost, usdToNano } from './money';
import { route, task } from './test-fixtures';

it('uses the exact optional request output cap for request and reservation', () => {
  const original = prepareProviderRequest(route, task);
  const capped = prepareProviderRequest(route, {
    ...task,
    maxOutputTokens: 3072,
  });
  const body = JSON.parse(capped.request.toString()) as { max_tokens: number };
  expect(body.max_tokens).toBe(3072);
  expect(capped.maximumNano).toBe(
    original.maximumNano -
      tokenCost(
        usdToNano(capped.tariff.completionPerMillionUsd),
        original.config.maxOutputTokens,
      ) +
      tokenCost(usdToNano(capped.tariff.completionPerMillionUsd), 3072),
  );
  expect(capped.requestSha256).not.toBe(original.requestSha256);
  expect(capped.taskSha256).not.toBe(original.taskSha256);
  expect(prepareProviderRequest(route, { ...task }).requestSha256).toBe(
    original.requestSha256,
  );
});
it.each([0, -1, 0.5, NaN, Infinity, 32769, 65537])(
  'refuses invalid output cap %s before dispatch',
  (maxOutputTokens) => {
    expect(() =>
      prepareProviderRequest(route, { ...task, maxOutputTokens }),
    ).toThrow();
  },
);
it('accepts the captured ceiling without changing the request or reservation', () => {
  const original = prepareProviderRequest(route, task);
  const capped = prepareProviderRequest(route, {
    ...task,
    maxOutputTokens: original.config.maxOutputTokens,
  });
  expect(capped.requestSha256).toBe(original.requestSha256);
  expect(capped.maximumNano).toBe(original.maximumNano);
});
