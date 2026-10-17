import {
  nativeTask2,
  nativeResponse2,
} from '../../../pdf-conversion/reconstruction/native-structure-v2-fixture';
import { nativeStructure2ProviderTask } from '../../../pdf-conversion/reconstruction/native-structure-v2-provider-task';
import { checksumBuffer } from '../../../shared/blob-utils';
import { route } from './test-fixtures';
import { jsonHash } from './hash';

export { nativeTask2, nativeResponse2 };
export const nativeProviderTask = nativeStructure2ProviderTask(
  nativeTask2,
  nativeTask2.source_sha256,
  nativeTask2.page_number,
);
export const nativeRoute = {
  ...route,
  modelId: 'google/gemini-contract-control',
  configuration: {
    ...(route.configuration as object),
    promptHashes: {
      [nativeProviderTask.promptVersion]: checksumBuffer(
        Buffer.from(nativeProviderTask.messages[0].content as string),
      ),
    },
    schemaHashes: {
      [nativeProviderTask.schemaVersion]: jsonHash(
        nativeProviderTask.responseSchema,
      ),
    },
  },
};
