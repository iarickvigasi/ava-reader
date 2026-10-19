import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { QuoteRepairTask } from './anchor-quote-types';
import type { RecognitionOverflowContextTask } from './generated/RecognitionOverflowContextTask';
export type AnchorRepairTask =
  | RecognitionAnchorContextTask
  | RecognitionOverflowContextTask
  | QuoteRepairTask;
