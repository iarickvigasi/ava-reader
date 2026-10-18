import parent from './fixtures/small-caps-parent-task.json';
import original from './fixtures/small-caps-original.json';
import task from './fixtures/small-caps-task.json';
import response from './fixtures/small-caps-response.json';
import { validatePacket } from './validate-packet';
export const capsParent = validatePacket('RecognitionTask', parent);
export const capsOriginal = validatePacket('RecognitionResponse', original);
export const capsTask = validatePacket('RecognitionSmallCapsQuoteTask', task);
export const capsResponse = validatePacket(
  'RecognitionAnchorQuoteResponse',
  response,
);
