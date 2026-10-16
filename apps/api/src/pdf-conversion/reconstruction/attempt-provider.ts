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
} from '../../library/pdf-import/admission/profile';
import type { CoordinatorDependencies } from './coordinator-types';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RefinementTask } from './refinement-packets';
import { refinementResponse } from './refinement-response';
import { providerTask } from './provider-task';
import { refinementProviderTask } from './refinement-provider-task';
import { recognitionResponse } from './recognition-response';
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
  return {
    response: recognitionResponse(task, receipt.output),
    originalResponseJson: receipt.output,
  };
}

export async function refineAttemptTask(
  task: RefinementTask,
  context: AttemptContext,
  signal: AbortSignal,
) {
  context.checkActive(signal);
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
    anchorContextProviderTask(
      task,
      parent,
      original,
      task.schema_version === 'ava-recognition-anchor-quote-task-2',
    ),
    signal,
  );
  context.checkActive(signal);
  return anchorContextResponse(task, receipt.output, parent, original);
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
  if (!context.validateGeometry)
    throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
  await context.validateGeometry(task, parent, signal);
  context.checkActive(signal);
  const receipt = await context.deps.dispatch(
    task.schema_version === 'ava-recognition-cell-geometry-task-1'
      ? cellGeometryProviderTask(task, parent, original, raw)
      : geometryProviderTask(task, parent, original, raw),
    signal,
  );
  context.checkActive(signal);
  return task.schema_version === 'ava-recognition-cell-geometry-task-1'
    ? cellGeometryResponse(task, receipt.output, parent, original)
    : geometryResponse(task, receipt.output, parent, original);
}
