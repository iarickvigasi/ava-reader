import { route, task } from './test-fixtures';
import { prepareProviderRequest } from './prepare-request';
import { routePolicy } from './route-policy';
import { checksumBuffer } from '../../../shared/blob-utils';
import type { PilotInventory } from './pilot-schema';
export function pilotFixture() {
  const image = Buffer.from('synthetic image bytes'),
    value = structuredClone(task);
  value.messages[1].content = [
    {
      type: 'image_url',
      image_url: {
        url: 'data:image/png;base64,' + image.toString('base64'),
      },
    },
  ];
  const config = {
    ...routePolicy(route.configuration, route.tariff).config,
    zeroDataRetention: true,
  };
  const prepared = prepareProviderRequest(
    { ...route, configuration: config },
    value,
  );
  const pilotInventory: PilotInventory = {
    version: 1,
    workerFingerprint: 'e'.repeat(64),
    maxRequests: 1,
    totalLimitNano: '1000000000',
    operations: [
      {
        operationId: 'operation-1',
        ownerId: 'owner-1',
        sourceSha256: value.sourceSha256,
        operationLimitNano: prepared.maximumNano.toString(),
        tasks: [
          {
            taskId: value.taskId,
            taskSha256: prepared.taskSha256,
            requestSha256: prepared.requestSha256,
            renderSha256: checksumBuffer(image),
          },
        ],
      },
    ],
  };
  return {
    task: value,
    config: { ...config, pilotInventory },
    prepared,
    route: { ...route, configuration: { ...config, pilotInventory } },
  };
}
