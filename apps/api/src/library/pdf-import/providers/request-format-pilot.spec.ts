import { prepareProviderRequest } from './prepare-request';
import {
  nativeProviderTask,
  nativeRoute,
  nativeTask2,
} from './native-request-fixture';
import { jsonHash } from './hash';

it('requires a pilot to authorize the actual JSON-mode request hash', () => {
  const base = {
    ...nativeRoute,
    configuration: { ...nativeRoute.configuration, zeroDataRetention: true },
  };
  const prepared = prepareProviderRequest(base, nativeProviderTask);
  const body = JSON.parse(prepared.request.toString()) as {
    messages: typeof nativeProviderTask.messages;
  };
  body.messages = nativeProviderTask.messages;
  const entry = {
    taskId: nativeProviderTask.taskId,
    taskSha256: prepared.taskSha256,
    requestSha256: prepared.requestSha256,
    renderSha256: nativeTask2.image.sha256,
  };
  const configured = {
    ...base,
    configuration: {
      ...base.configuration,
      pilotInventory: {
        version: 1,
        workerFingerprint: 'c'.repeat(64),
        maxRequests: 1,
        totalLimitNano: '1000000000',
        operations: [
          {
            operationId: 'authored-op',
            ownerId: 'authored-owner',
            sourceSha256: nativeProviderTask.sourceSha256,
            operationLimitNano: prepared.maximumNano.toString(),
            tasks: [entry],
          },
        ],
      },
    },
  };
  expect(
    prepareProviderRequest(configured, nativeProviderTask).requestSha256,
  ).toBe(prepared.requestSha256);
  entry.requestSha256 = jsonHash(body);
  expect(() => prepareProviderRequest(configured, nativeProviderTask)).toThrow(
    'PDF_PROVIDER_PILOT_UNAUTHORIZED',
  );
});
