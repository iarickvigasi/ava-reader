import batch from './fixtures/word-wrap-batch.json';
import responses from './fixtures/word-wrap-responses.json';
import { validatePacket } from './validate-packet';

export const wrapBatch = validatePacket(
  'WordWrapBatch',
  structuredClone(batch),
);
export const wrapResponses = responses.map((r) =>
  validatePacket('WordWrapResponse', structuredClone(r)),
);
export const wrapTask = wrapBatch.tasks[0];
