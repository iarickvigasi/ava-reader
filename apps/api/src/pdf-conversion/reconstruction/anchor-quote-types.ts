import type { RecognitionAnchorQuoteTask } from './generated/RecognitionAnchorQuoteTask';
import type { RecognitionSmallCapsQuoteTask } from './generated/RecognitionSmallCapsQuoteTask';

export type QuoteRepairTask =
  | RecognitionAnchorQuoteTask
  | RecognitionSmallCapsQuoteTask;
export function isQuoteRepair(task: {
  schema_version: string;
}): task is QuoteRepairTask {
  return [
    'ava-recognition-anchor-quote-task-2',
    'ava-recognition-anchor-quote-task-3',
  ].includes(task.schema_version);
}
export function requiresContinuation(task: { schema_version: string }) {
  return [
    'ava-recognition-anchor-context-task-2',
    'ava-recognition-anchor-quote-task-3',
  ].includes(task.schema_version);
}
