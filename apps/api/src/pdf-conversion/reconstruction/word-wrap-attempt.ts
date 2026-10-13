import type { AttemptContext } from './attempt-provider';
import type { WordWrapBatch } from './generated/WordWrapBatch';
import type { WordWrapResponse } from './generated/WordWrapResponse';
import { wordWrapBatch } from './word-wrap-batch';
import { wordWrapProviderTask } from './word-wrap-provider-task';
import { wordWrapResponse } from './word-wrap-response';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function wordWrapAttempt(
  context: AttemptContext,
  seen: (id: string) => boolean,
  retain: (response: WordWrapResponse) => void,
) {
  let batch: WordWrapBatch | undefined;
  const responses: WordWrapResponse[] = [];
  return {
    responses,
    accept(payload: unknown, pageCount: number) {
      if (!context.sourceNormalizationPolicy || batch)
        throw new PdfRuntimeError('INVALID_RESULT');
      const prepared = wordWrapBatch(payload, context);
      if (
        prepared.entries.some(
          (entry) =>
            entry.left.page > pageCount ||
            entry.right.page > pageCount ||
            entry.candidate.left.page > pageCount ||
            entry.candidate.right.page > pageCount,
        ) ||
        prepared.census.some((line) => line.page > pageCount)
      )
        throw new PdfRuntimeError('SOURCE_MISMATCH');
      if (prepared.tasks.length && context.providerMode === 'native')
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      if (prepared.tasks.some((task) => seen(task.task_id)))
        throw new PdfRuntimeError('INVALID_RESULT');
      batch = prepared;
    },
    async resolve(id: string, signal: AbortSignal) {
      const task = batch?.tasks[responses.length];
      if (!task || task.task_id !== id)
        throw new PdfRuntimeError('INVALID_RESULT');
      context.checkActive(signal);
      const providerTask = wordWrapProviderTask(
        task,
        context.sourceSha256,
        context.profileId,
      );
      if (!context.validateWordWrap)
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      await context.validateWordWrap(task, signal);
      context.checkActive(signal);
      const receipt = await context.deps.dispatch(providerTask, signal);
      context.checkActive(signal);
      const response = wordWrapResponse(task, receipt.output);
      retain(response);
      responses.push(response);
      return response;
    },
    complete() {
      if (
        context.sourceNormalizationPolicy &&
        (!batch || responses.length !== batch.tasks.length)
      )
        throw new PdfRuntimeError('INVALID_RESULT');
    },
  };
}
