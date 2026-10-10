import Ajv2020 from 'ajv/dist/2020';
import { recognitionSchemas } from './generated/schemas';
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

type Packets = {
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
