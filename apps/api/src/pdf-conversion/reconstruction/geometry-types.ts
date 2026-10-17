import type { RecognitionGeometryTask } from './generated/RecognitionGeometryTask';
import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import type { RecognitionGeometryProof } from './generated/RecognitionGeometryProof';
import type { RecognitionCellGeometryProof } from './generated/RecognitionCellGeometryProof';
export type AnyGeometryTask =
  | RecognitionGeometryTask
  | RecognitionCellGeometryTask;
export type AnyGeometryProof =
  | RecognitionGeometryProof
  | RecognitionCellGeometryProof;
