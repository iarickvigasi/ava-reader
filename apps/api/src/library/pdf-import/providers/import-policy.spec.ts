import { routePolicy } from './route-policy';
import { config, tariff } from './test-fixtures';
import { requireImportBudgets } from './import-policy';
import { requireRouteOperation } from './route-authority';
import { pilotFixture } from './pilot-fixtures';
const policy = {
  version: 1 as const,
  workerFingerprint: 'e'.repeat(64),
  profileId: 'profile',
  configSha256: 'c'.repeat(64),
  maxRequestsPerOperation: 10,
};
const valid = () =>
  routePolicy(
    {
      ...config,
      authorizedSourceSha256: [],
      zeroDataRetention: true,
      importPolicy: policy,
    },
    tariff,
  ).config;
const scope = {
  operationId: 'ordinary-operation',
  ownerId: 'owner',
  sourceSha256: 'd'.repeat(64),
  profileId: 'profile',
  configSha256: 'c'.repeat(64),
};
describe('ordinary import route authority', () => {
  it('admits a source-bound operation without predeclared pilot tasks', () => {
    expect(() =>
      requireRouteOperation(valid(), 'live', scope, 'e'.repeat(64)),
    ).not.toThrow();
  });
  it.each(['profileId', 'configSha256', 'sourceSha256', 'ownerId'] as const)(
    'rejects changed or missing %s',
    (field) => {
      expect(() =>
        requireRouteOperation(
          valid(),
          'live',
          { ...scope, [field]: '' },
          'e'.repeat(64),
        ),
      ).toThrow();
    },
  );
  it('rejects worker mismatch and nonlive use', () => {
    expect(() =>
      requireRouteOperation(valid(), 'live', scope, 'f'.repeat(64)),
    ).toThrow();
    expect(() => requireRouteOperation(valid(), 'stub', scope)).toThrow();
  });
  it.each([
    { zeroDataRetention: false },
    { authorizedSourceSha256: ['a'.repeat(64)] },
    { operationLimitNano: '10000000001' },
    { pilotInventory: pilotFixture().config.pilotInventory },
    { importPolicy: { ...policy, maxRequestsPerOperation: 0 } },
  ])('rejects ambiguous or unbounded authority %j', (override) => {
    expect(() =>
      routePolicy(
        {
          ...config,
          authorizedSourceSha256: [],
          zeroDataRetention: true,
          importPolicy: policy,
          ...override,
        },
        tariff,
      ),
    ).toThrow();
  });
  it('keeps source inventories mandatory without an import policy', () => {
    expect(() =>
      routePolicy({ ...config, authorizedSourceSha256: [] }, tariff),
    ).toThrow();
  });
  it.each([
    [15_000_000_000n, 15_000_000_000n, true],
    [14_000_000_000n, 15_000_000_000n, true],
    [15_000_000_001n, 15_000_000_000n, false],
  ])(
    'enforces the explicit model limit %s within ceiling %s',
    (limitNano, hardCeilingNano, allowed) => {
      const check = () =>
        requireImportBudgets(valid(), [
          { scope: 'MODEL', limitNano, hardCeilingNano },
        ]);
      if (allowed) expect(check).not.toThrow();
      else expect(check).toThrow('PDF_PROVIDER_IMPORT_BUDGET_INVALID');
    },
  );
});
