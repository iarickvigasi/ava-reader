import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorQuoteTask } from './generated/RecognitionAnchorQuoteTask';
import type { RecognitionOverflowContextTask } from './generated/RecognitionOverflowContextTask';
export type AnchorRepairTask =
  | RecognitionAnchorContextTask
  | RecognitionOverflowContextTask
  | RecognitionAnchorQuoteTask;
