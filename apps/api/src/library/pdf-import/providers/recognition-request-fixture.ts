import { task as recognitionTask } from '../../../pdf-conversion/reconstruction/test-fixture';
import { providerTask } from '../../../pdf-conversion/reconstruction/provider-task';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
import { route } from './test-fixtures';

export { recognitionTask };
export const recognitionProviderTask = providerTask(
  recognitionTask,
  recognitionTask.source_sha256,
  recognitionTask.page_number,
);
export const recognitionRoute = {
  ...route,
  modelId: 'google/gemini-contract-control',
  configuration: {
    ...(route.configuration as object),
    promptHashes: {
      [recognitionProviderTask.promptVersion]: checksumBuffer(
        Buffer.from(recognitionProviderTask.messages[0].content as string),
      ),
    },
    schemaHashes: {
      [recognitionProviderTask.schemaVersion]: jsonHash(
        recognitionProviderTask.responseSchema,
      ),
    },
  },
};
