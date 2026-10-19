import { prepareProviderRequest } from './prepare-request';
import { routePolicy } from './route-policy';
import { config, route, task, tariff } from './test-fixtures';

it('pins reasoning only for the explicitly funded prompt without changing legacy requests', () => {
  const legacy = prepareProviderRequest(route, task);
  const policy = { ...config, reasoningEffortByPrompt: { 'prompt-1': 'low' } };
  const selected = prepareProviderRequest(
    { ...route, configuration: policy },
    task,
  );
  expect(JSON.parse(selected.request.toString()) as unknown).toMatchObject({
    reasoning: { effort: 'low' },
    max_tokens: config.maxOutputTokens,
  });
  expect(JSON.parse(legacy.request.toString()) as unknown).not.toHaveProperty(
    'reasoning',
  );
  expect(selected.requestSha256).not.toBe(legacy.requestSha256);
  expect(selected.taskSha256).toBe(legacy.taskSha256);
  expect(selected.maximumNano).toBe(legacy.maximumNano);
  const other = prepareProviderRequest(
    {
      ...route,
      configuration: {
        ...policy,
        promptHashes: {
          ...config.promptHashes,
          'prompt-2': config.promptHashes['prompt-1'],
        },
      },
    },
    { ...task, promptVersion: 'prompt-2' },
  );
  expect(JSON.parse(other.request.toString()) as unknown).not.toHaveProperty(
    'reasoning',
  );
});

it.each(['none', 'minimal', 'arbitrary', 0, null])(
  'refuses unsupported route effort %s',
  (effort) => {
    expect(() =>
      routePolicy(
        { ...config, reasoningEffortByPrompt: { 'prompt-1': effort } },
        tariff,
      ),
    ).toThrow();
  },
);

it('refuses effort policy for an unauthorized prompt before provider dispatch', () => {
  expect(() =>
    routePolicy(
      { ...config, reasoningEffortByPrompt: { unfunded: 'low' } },
      tariff,
    ),
  ).toThrow();
});
