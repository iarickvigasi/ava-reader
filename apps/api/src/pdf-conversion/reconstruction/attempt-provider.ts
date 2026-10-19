import { observeAnchorContextProjection } from './observe-anchor-context-projection';
import { assertLocalCellGeometryPolicy } from './local-cell-geometry-policy';
import {
  LOCAL_CELL_OCR_POLICY,
  type LocalCellOcrPolicy,
} from '../../library/pdf-import/admission/cell-ocr-policy';
import type { localizeCellGeometry } from './local-cell-geometry';
import { observeLocalCellGeometry } from './observe-local-cell-geometry';
import type { RecognitionCellGeometryTask } from './generated/RecognitionCellGeometryTask';
import { isQuoteRepair } from './anchor-quote-types';
import type { PresentationRefinementTask } from './generated/PresentationRefinementTask';
import type { PresentationRefinementResponse } from './generated/PresentationRefinementResponse';
import { SOURCE_CONTINUATION_POLICY } from '../../library/pdf-import/admission/profile';
import type { FrontmatterTitleTask } from './generated/FrontmatterTitleTask';
import type { FrontmatterTitleResponse } from './generated/FrontmatterTitleResponse';
import { FRONTMATTER_TITLE_POLICY } from '../../library/pdf-import/admission/profile';
import type { AnyGeometryTask } from './geometry-types';
import { cellGeometryProviderTask } from './cell-geometry-provider-task';
import { cellGeometryResponse } from './cell-geometry-response';
import { geometryProviderTask } from './geometry-provider-task';
import { geometryResponse } from './geometry-response';
import type { WordWrapTask } from './generated/WordWrapTask';
import type {
  NativeLayoutPolicy,
  NativeStructurePolicy,
  SourceNormalizationPolicy,
  RecognitionRepairPolicy,
  SourceTitlePolicy,
  SourceContinuationPolicy,
} from '../../library/pdf-import/admission/profile';
import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RefinementTask } from './refinement-packets';
import { refinementResponse } from './refinement-response';
import { providerTask } from './provider-task';
import { refinementProviderTask } from './refinement-provider-task';
import { recognitionAttemptResult } from './recognition-attempt-result';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { AnchorRepairTask } from './anchor-repair-types';
import { anchorContextProviderTask } from './anchor-context-provider-task';
import { anchorContextResponse } from './anchor-context-response';
import { PdfRuntimeError } from '../runtime/runtime-error';

export type AttemptContext = {
  deps: CoordinatorDependencies;
  sourceSha256: string;
  profileId: RecognitionTask['profile_id'];
  providerMode: string;
  pageLimit: number;
  sourceLayoutPolicy?: NativeLayoutPolicy;
  sourceStructurePolicy?: NativeStructurePolicy;
  sourceNormalizationPolicy?: SourceNormalizationPolicy;
  recognitionRepairPolicy?: RecognitionRepairPolicy;
  sourceTitlePolicy?: SourceTitlePolicy;
  sourceContinuationPolicy?: SourceContinuationPolicy;
  localCellGeometryPolicy?: LocalCellOcrPolicy;
  localizeCellGeometry?: (
    task: RecognitionCellGeometryTask,
    original: RecognitionTask,
    signal: AbortSignal,
  ) => ReturnType<typeof localizeCellGeometry>;
  validateContinuation?: (
    task: PresentationRefinementTask,
    response: PresentationRefinementResponse | null,
    signal: AbortSignal,
  ) => Promise<void>;
  validateFrontmatterTitle?: (
    task: FrontmatterTitleTask,
    response: FrontmatterTitleResponse | null,
    signal: AbortSignal,
  ) => Promise<void>;
  validateGeometry?: (
    correction: AnyGeometryTask,
    task: RecognitionTask,
    signal: AbortSignal,
  ) => Promise<void>;
  validateWordWrap?: (task: WordWrapTask, signal: AbortSignal) => Promise<void>;
  validateAnchorContext?: (
    correction: AnchorRepairTask,
    task: RecognitionTask,
    signal: AbortSignal,
  ) => Promise<void>;
  checkActive: (signal: AbortSignal) => void;
};

export async function recognizeAttemptReceipt(
  task: RecognitionTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    providerTask(task, context.sourceSha256, task.page_number),
    signal,
  );
  context.checkActive(signal);
  return recognitionAttemptResult(
    task,
    receipt.output,
    context.recognitionRepairPolicy === 'ava-recognition-geometry-repair-2' &&
      context.sourceContinuationPolicy === SOURCE_CONTINUATION_POLICY,
  );
}

export async function refineAttemptTask(
  task: RefinementTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  if (task.schema_version === 'ava-book-refinement-task-5') {
    if (
      context.sourceContinuationPolicy !== SOURCE_CONTINUATION_POLICY ||
      !context.validateContinuation
    )
      throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    await context.validateContinuation(task, null, signal);
    context.checkActive(signal);
  }
  if (task.schema_version === 'ava-printed-title-task-2') {
    if (
      context.sourceTitlePolicy !== FRONTMATTER_TITLE_POLICY ||
      !context.validateFrontmatterTitle
    )
      throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    await context.validateFrontmatterTitle(task, null, signal);
    context.checkActive(signal);
  }
  const receipt = await context.deps.dispatch(
    refinementProviderTask(task, context.sourceSha256),
    signal,
  );
  context.checkActive(signal);
  const response = refinementResponse(task, receipt.output);
  if (task.schema_version === 'ava-book-refinement-task-5') {
    if (
      response.schema_version !== 'ava-book-refinement-response-5' ||
      !context.validateContinuation
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    await context.validateContinuation(task, response, signal);
    context.checkActive(signal);
  }
  if (task.schema_version === 'ava-printed-title-task-2') {
    if (
      response.schema_version !== 'ava-printed-title-response-2' ||
      !context.validateFrontmatterTitle
    )
      throw new PdfRuntimeError('INVALID_RESULT');
    await context.validateFrontmatterTitle(task, response, signal);
    context.checkActive(signal);
  }
  return response;
}

export async function correctAttemptAnchorContext(
  task: AnchorRepairTask,
  parent: RecognitionTask,
  original: RecognitionResponse,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  if (!context.validateAnchorContext)
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  await context.validateAnchorContext(task, parent, signal);
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    anchorContextProviderTask(task, parent, original, isQuoteRepair(task)),
    signal,
  );
  context.checkActive(signal);
  const result = anchorContextResponse(task, receipt.output, parent, original);
  observeAnchorContextProjection(
    task,
    'projection' in result ? result.projection : undefined,
    context,
  );
  return result;
}

export async function recognizeAttemptTask(
  task: RecognitionTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  return (await recognizeAttemptReceipt(task, context, signal)).response;
}

export async function correctAttemptGeometry(
  task: AnyGeometryTask,
  parent: RecognitionTask,
  original: RecognitionResponse,
  raw: string,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
  assertLocalCellGeometryPolicy(context);
  if (!context.validateGeometry)
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  await context.validateGeometry(task, parent, signal);
  context.checkActive(signal);
  const provider =
    task.schema_version === 'ava-recognition-cell-geometry-task-1'
      ? cellGeometryProviderTask(task, parent, original, raw)
      : geometryProviderTask(task, parent, original, raw);
  if (
    task.schema_version === 'ava-recognition-cell-geometry-task-1' &&
    context.localCellGeometryPolicy
  ) {
    if (
      context.localCellGeometryPolicy !== LOCAL_CELL_OCR_POLICY ||
      !context.localizeCellGeometry
    )
      throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
    const local = await context.localizeCellGeometry(task, parent, signal);
    context.checkActive(signal);
    if (local.status === 'PROVED') {
      const corrected = cellGeometryResponse(
        task,
        local.response_json,
        parent,
        original,
      );
      if (!corrected.corrected) throw new PdfRuntimeError('INVALID_RESULT');
      observeLocalCellGeometry(task, local, context);
      return corrected;
    }
    observeLocalCellGeometry(task, local, context);
  }
  const receipt = await context.deps.dispatch(provider, signal);
  context.checkActive(signal);
  return task.schema_version === 'ava-recognition-cell-geometry-task-1'
    ? cellGeometryResponse(task, receipt.output, parent, original)
    : geometryResponse(task, receipt.output, parent, original);
}
