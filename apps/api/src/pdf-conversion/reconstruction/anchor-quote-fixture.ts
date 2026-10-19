import parent from './fixtures/anchor-quote-parent.json';
import original from './fixtures/anchor-quote-original.json';
import task from './fixtures/anchor-quote-task.json';
import response from './fixtures/anchor-quote-response.json';
import { validatePacket } from './validate-packet';
export const quoteParent = validatePacket('RecognitionTask', parent);
export const quoteOriginal = validatePacket('RecognitionResponse', original);
export const quoteTask = validatePacket('RecognitionAnchorQuoteTask', task);
export const quoteResponse = validatePacket(
  'RecognitionAnchorQuoteResponse',
  response,
);
