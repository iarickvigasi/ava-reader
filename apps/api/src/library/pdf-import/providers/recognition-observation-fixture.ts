import {
  authoredTask,
  authoredResponse,
} from '../../../pdf-conversion/reconstruction/recognition-json-authored-fixture';
import { providerTask } from '../../../pdf-conversion/reconstruction/provider-task';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
import { recognitionRoute } from './recognition-request-fixture';
import { RECOGNITION_OBSERVATION_WIRE } from './recognition-observation-contract';
export { authoredTask };
export const observationTask = providerTask(
  authoredTask,
  authoredTask.source_sha256,
  1,
);
export const observationRoute = {
  ...recognitionRoute,
  configuration: {
    ...(recognitionRoute.configuration as object),
    promptHashes: {
      [observationTask.promptVersion]: checksumBuffer(
        Buffer.from(observationTask.messages[0].content as string),
      ),
    },
    schemaHashes: {
      [observationTask.schemaVersion]: jsonHash(observationTask.responseSchema),
    },
  },
};
const segment: Record<string, unknown> = structuredClone(
  authoredResponse.segments[0],
);
delete segment.page;
segment.spans = [
  { ...authoredResponse.segments[0].spans[0], style: { italic: true } },
];
export const observationResponse = {
  schema_version: RECOGNITION_OBSERVATION_WIRE,
  language: authoredResponse.language,
  unresolved: [],
  segments: [segment],
};
