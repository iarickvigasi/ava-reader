import { pilotFixture } from './pilot-fixtures';
import { routePolicy } from './route-policy';
import type { RouteConfiguration } from './types';
const changed: [string, (c: RouteConfiguration) => void][] = [
  [
    'counter expansion',
    (c) => {
      c.pilotInventory!.maxRequests = 2;
    },
  ],
  [
    'duplicate operation',
    (c) => {
      c.pilotInventory!.operations.push(c.pilotInventory!.operations[0]);
    },
  ],
  [
    'duplicate task',
    (c) => {
      c.pilotInventory!.operations[0].tasks.push(
        c.pilotInventory!.operations[0].tasks[0],
      );
    },
  ],
  [
    'broader sources',
    (c) => {
      c.authorizedSourceSha256.push('b'.repeat(64));
    },
  ],
  [
    'privacy weakened',
    (c) => {
      c.zeroDataRetention = false;
    },
  ],
  [
    'image count broadened',
    (c) => {
      c.maxImages = 2;
    },
  ],
  [
    'extra operation funds',
    (c) => {
      c.pilotInventory!.operations[0].operationLimitNano = '1000000000';
    },
  ],
];
describe('finite pilot policy', () => {
  it('accepts exact bounded inventory', () => {
    const f = pilotFixture();
    expect(routePolicy(f.config, f.route.tariff).maximumNano).toBe(
      f.prepared.maximumNano,
    );
  });
  it('includes the observed per-image fee in the exact reserve', () => {
    const f = pilotFixture();
    const tariff = { ...(f.route.tariff as object), imageUsd: '0.00000135' };
    expect(() => routePolicy(f.config, tariff)).toThrow(
      'PDF_PROVIDER_PILOT_INVALID',
    );
    const maximum = f.prepared.maximumNano + 1350n;
    f.config.pilotInventory.operations[0].operationLimitNano = String(maximum);
    expect(routePolicy(f.config, tariff).maximumNano).toBe(maximum);
  });
  it.each(changed)('refuses %s', (_, change) => {
    const f = pilotFixture();
    change(f.config);
    expect(() => routePolicy(f.config, f.route.tariff)).toThrow();
  });
  it('rejects missing operation identity and unknown fields', () => {
    const f = pilotFixture(),
      c = JSON.parse(JSON.stringify(f.config)) as Record<string, unknown>;
    c.pilotInventory = {
      ...f.config.pilotInventory,
      operations: [
        { ...f.config.pilotInventory.operations[0], operationId: null },
      ],
    };
    expect(() => routePolicy(c, f.route.tariff)).toThrow();
    expect(() =>
      routePolicy({ ...f.config, unrestricted: true }, f.route.tariff),
    ).toThrow();
  });
});
