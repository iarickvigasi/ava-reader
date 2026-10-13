import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from './generated/schemas';
import type { NativeLayoutPrepareResult } from './generated/NativeLayoutPrepareResult';
import type { NativeLayoutReconstructionInput } from './generated/NativeLayoutReconstructionInput';
import type { PrepareResult } from './generated/PrepareResult';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { ReconstructionInput } from './generated/ReconstructionInput';
import type { ReconstructionReport } from './generated/ReconstructionReport';
import { PdfRuntimeError } from '../runtime/runtime-error';

import type { BookRefinementTask } from './generated/BookRefinementTask';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { SourceFeatureTask } from './generated/SourceFeatureTask';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
import type { RefinementBatch } from './generated/RefinementBatch';
import type { PrintedTitleTask } from './generated/PrintedTitleTask';
import type { PrintedTitleResponse } from './generated/PrintedTitleResponse';
import type { PrintedTitleRefinementBatch } from './generated/PrintedTitleRefinementBatch';
import type { PrintedTitleReconstructionInput } from './generated/PrintedTitleReconstructionInput';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorContextResponse } from './generated/RecognitionAnchorContextResponse';

type Packets = {
  RecognitionAnchorContextTask: RecognitionAnchorContextTask;
  RecognitionAnchorContextResponse: RecognitionAnchorContextResponse;
  NativeLayoutPrepareResult: NativeLayoutPrepareResult;
  NativeLayoutReconstructionInput: NativeLayoutReconstructionInput;
  PrintedTitleTask: PrintedTitleTask;
  PrintedTitleResponse: PrintedTitleResponse;
  PrintedTitleRefinementBatch: PrintedTitleRefinementBatch;
  PrintedTitleReconstructionInput: PrintedTitleReconstructionInput;
  BookRefinementTask: BookRefinementTask;
  BookRefinementResponse: BookRefinementResponse;
  SourceFeatureTask: SourceFeatureTask;
  SourceFeatureResponse: SourceFeatureResponse;
  RefinementBatch: RefinementBatch;
  PrepareResult: PrepareResult;
  RecognitionTask: RecognitionTask;
  RecognitionResponse: RecognitionResponse;
  ReconstructionInput: ReconstructionInput;
  ReconstructionReport: ReconstructionReport;
};
const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  validateFormats: false,
});
ajv.addKeyword({ keyword: 'discriminator', valid: true });
const validators = new Map(
  Object.entries(recognitionSchemas).map(([name, schema]) => [
    name,
    ajv.compile(schema),
  ]),
);
export function validatePacket<K extends keyof Packets>(
  name: K,
  value: unknown,
): Packets[K] {
  if (!validators.get(name)?.(value))
    throw new PdfRuntimeError('INVALID_RESULT');
  if (name === 'PrintedTitleRefinementBatch') {
    const packet = value as unknown as PrintedTitleRefinementBatch;
    if (
      packet.tasks.filter(
        (task) => task.schema_version === 'ava-printed-title-task-1',
      ).length !== 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'NativeLayoutReconstructionInput') {
    const packet = value as unknown as NativeLayoutReconstructionInput;
    if (
      (packet.refinements ?? []).filter(
        (r) => r.schema_version === 'ava-printed-title-response-1',
      ).length > 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'PrintedTitleReconstructionInput') {
    const packet = value as unknown as PrintedTitleReconstructionInput;
    if (
      (packet.refinements ?? []).filter(
        (response) =>
          response.schema_version === 'ava-printed-title-response-1',
      ).length !== 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  return value as unknown as Packets[K];
}
export function parsePacket<K extends keyof Packets>(
  name: K,
  bytes: Buffer,
  limit: number,
): Packets[K] {
  if (bytes.length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
  try {
    return validatePacket(
      name,
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      ) as unknown,
    );
  } catch (error) {
    if (error instanceof PdfRuntimeError) throw error;
    throw new PdfRuntimeError('INVALID_RESULT');
  }
}
