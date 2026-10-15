import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorQuoteTask } from './generated/RecognitionAnchorQuoteTask';
export type AnchorRepairTask =
  | RecognitionAnchorContextTask
  | RecognitionAnchorQuoteTask;
