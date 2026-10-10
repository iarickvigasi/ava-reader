import { pilotFixture } from './pilot-fixtures';
import { prepareProviderRequest } from './prepare-request';
import { routePolicy } from './route-policy';
import type { ProviderTask } from './types';
const mutations: [string, (t: ProviderTask) => void][] = [
  [
    'new task',
    (t) => {
      t.taskId = 'new-task';
    },
  ],
  [
    'source',
    (t) => {
      t.sourceSha256 = 'b'.repeat(64);
    },
  ],
  [
    'page',
    (t) => {
      t.pageIndices = [1];
    },
  ],
  [
    'purpose',
    (t) => {
      t.purpose = 'resolve_structure';
    },
  ],
  [
    'render',
    (t) => {
      t.messages[1].content = [
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,Y2hhbmdlZA==' },
        },
      ];
    },
  ],
  [
    'native text',
    (t) => {
      t.messages.push({ role: 'user', content: 'extra evidence' });
    },
  ],
];
describe('pilot encoded request guard', () => {
  it('accepts the exact payload repeatedly without expanding inventory', () => {
    const f = pilotFixture();
    expect(prepareProviderRequest(f.route, f.task).requestSha256).toBe(
      f.prepared.requestSha256,
    );
    expect(
      prepareProviderRequest(f.route, structuredClone(f.task)).taskSha256,
    ).toBe(f.prepared.taskSha256);
  });
  it.each(mutations)('refuses changed %s', (_, change) => {
    const f = pilotFixture();
    change(f.task);
    expect(() => prepareProviderRequest(f.route, f.task)).toThrow();
  });
  it.each(['modelId', 'providerSlug'])(
    'binds %s in encoded request',
    (field) => {
      const f = pilotFixture();
      expect(() =>
        prepareProviderRequest({ ...f.route, [field]: 'different' }, f.task),
      ).toThrow();
    },
  );
  it('checks declared render independently of task/request hashes', () => {
    const f = pilotFixture();
    f.config.pilotInventory.operations[0].tasks[0].renderSha256 = 'b'.repeat(
      64,
    );
    expect(() => prepareProviderRequest(f.route, f.task)).toThrow();
  });
  it('rejects surcharges and an aggregate exceeding the pilot dollar', () => {
    const f = pilotFixture();
    expect(() =>
      routePolicy(f.config, {
        ...(f.route.tariff as object),
        imageUsd: '0.01',
      }),
    ).toThrow();
    expect(() =>
      routePolicy(f.config, {
        ...(f.route.tariff as object),
        promptPerMillionUsd: '100',
      }),
    ).toThrow();
  });
});
