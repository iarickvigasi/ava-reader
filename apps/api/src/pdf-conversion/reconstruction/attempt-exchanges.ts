import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { exchangeProtocol } from '../runtime/exchange-protocol';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { validatePacket } from './validate-packet';
import type { PrepareResult } from './generated/PrepareResult';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RefinementBatch } from './generated/RefinementBatch';
import type { BookRefinementResponse } from './generated/BookRefinementResponse';
import type { SourceFeatureResponse } from './generated/SourceFeatureResponse';
import { parseSourceRefusal, type SourceContentError } from './source-refusal';
import {
  recognizeAttemptTask,
  refineAttemptTask,
  type AttemptContext,
} from './attempt-provider';

// The worker accepts each response before requesting another task. Keeping that
// round trip prevents spending on later tasks after an invalid earlier response.
export function attemptExchanges(context: AttemptContext) {
  const protocol = exchangeProtocol({
    source_sha256: context.sourceSha256,
    profile_id: context.profileId,
  });
  const taskIds = new Set<string>();
  const responses: RecognitionResponse[] = [];
  const refinements: (BookRefinementResponse | SourceFeatureResponse)[] = [];
  let currentPage: PrepareResult | undefined,
    pages: number | undefined,
    preparedPages = 0,
    recognitionIndex = 0,
    responseBytes = 0,
    batch: RefinementBatch | undefined,
    refinementIndex = 0,
    failed = false,
    terminal = false,
    refusal: SourceContentError | PdfRuntimeError | undefined;
  const invalid = () => {
    throw new PdfRuntimeError('INVALID_RESULT');
  };
  const completePage = async (signal: AbortSignal) => {
    if (!currentPage) return;
    if (recognitionIndex !== currentPage.tasks.length) invalid();
    context.checkActive(signal);
    await context.deps.progress({
      stage: 'EXTRACTION',
      completed: currentPage.page_number,
      total: pages,
    });
  };
  const reconstructionInput = () => ({
    schema_version: 'ava-reconstruct-input-1',
    source_feature_policy: 'ava-ocr-source-features-1',
    profile_id: context.profileId,
    source_sha256: context.sourceSha256,
    responses,
    refinements,
  });
  const inputBound = () => {
    if (
      Buffer.byteLength(JSON.stringify(reconstructionInput())) >
      64 * 1024 ** 2
    )
      throw new PdfRuntimeError('RESOURCE_LIMIT');
  };
  async function handle(
    envelope: ExchangeEnvelope,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    if (envelope.kind === 'page') {
      const prepared = validatePacket('PrepareResult', envelope.payload);
      if (
        batch ||
        prepared.page_number !== preparedPages + 1 ||
        prepared.source_sha256 !== context.sourceSha256 ||
        (prepared.profile_id ?? 'ava-pdf-prose-en-v2') !== context.profileId ||
        prepared.source_page_count > context.pageLimit ||
        (pages !== undefined && pages !== prepared.source_page_count) ||
        prepared.tasks.some(
          (task) =>
            task.source_sha256 !== context.sourceSha256 ||
            task.page_number !== prepared.page_number ||
            task.profile_id !== context.profileId,
        )
      )
        throw new PdfRuntimeError('SOURCE_MISMATCH');
      if (prepared.tasks.length && context.providerMode === 'native')
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      for (const task of prepared.tasks) {
        if (taskIds.has(task.task_id)) invalid();
        taskIds.add(task.task_id);
      }
      await completePage(signal);
      pages = prepared.source_page_count;
      currentPage = prepared;
      recognitionIndex = 0;
      preparedPages++;
      const native = prepared.native_segment_count;
      context.deps.observer?.emit(
        'SOURCE_INSPECTED',
        'PAGE_ROUTE',
        context.deps.observer.nextUnit('page-route'),
        {
          sourcePages: pages,
          preparedRoute: {
            pageNumber: prepared.page_number,
            route: prepared.tasks.length
              ? native
                ? 'HYBRID'
                : 'RECOGNITION'
              : native
                ? 'NATIVE'
                : 'BLANK',
            nativeSegments: native,
            recognitionTasks: prepared.tasks.length,
          },
        },
      );
      return [];
    }
    if (envelope.kind === 'recognition') {
      const task = currentPage?.tasks[recognitionIndex];
      if (
        batch ||
        !task ||
        (envelope.payload as { task_id: string }).task_id !== task.task_id
      )
        return invalid();
      const response = await recognizeAttemptTask(task, context, signal);
      responseBytes += Buffer.byteLength(JSON.stringify(response)) + 1;
      if (responseBytes > 60 * 1024 ** 2)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      responses.push(response);
      recognitionIndex++;
      return [response];
    }
    if (envelope.kind === 'refinement_batch') {
      if (batch || !pages || preparedPages !== pages) return invalid();
      const prepared = validatePacket('RefinementBatch', envelope.payload);
      if (
        prepared.source_sha256 !== context.sourceSha256 ||
        prepared.tasks.some(
          (task) =>
            task.source_sha256 !== context.sourceSha256 ||
            task.profile_id !== context.profileId,
        )
      )
        throw new PdfRuntimeError('SOURCE_MISMATCH');
      if (prepared.tasks.length && context.providerMode === 'native')
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      if (
        new Set(prepared.tasks.map((task) => task.task_id)).size !==
        prepared.tasks.length
      )
        return invalid();
      await completePage(signal);
      context.checkActive(signal);
      await context.deps.progress({ stage: 'RECONSTRUCTION' });
      batch = prepared;
      inputBound();
      return [];
    }
    if (envelope.kind === 'refinement') {
      const task = batch?.tasks[refinementIndex];
      if (
        !task ||
        (envelope.payload as { task_id: string }).task_id !== task.task_id
      )
        return invalid();
      const response = await refineAttemptTask(task, context, signal);
      refinements.push(response);
      refinementIndex++;
      inputBound();
      return [response];
    }
    if (envelope.kind === 'artifacts') {
      if (
        !batch ||
        refinementIndex !== batch.tasks.length ||
        preparedPages !== pages
      )
        return invalid();
      inputBound();
      terminal = true;
      return [];
    }
    if (envelope.kind === 'refusal') {
      const payload = envelope.payload as {
        schema_version?: unknown;
        code?: unknown;
      } | null;
      refusal =
        payload?.schema_version === 'ava-source-refusal-1'
          ? parseSourceRefusal(
              Buffer.from(JSON.stringify(payload)),
              context.sourceSha256,
            )
          : new PdfRuntimeError('INVALID_RESULT');
      terminal = true;
      return [];
    }
    return invalid();
  }
  return {
    async exchange(bytes: Buffer, signal: AbortSignal) {
      if (failed) return invalid();
      try {
        context.checkActive(signal);
        const envelope = protocol.accept(bytes);
        if (
          envelope.source_sha256 !== context.sourceSha256 ||
          envelope.profile_id !== context.profileId
        )
          throw new PdfRuntimeError('SOURCE_MISMATCH');
        const payload = await handle(envelope, signal);
        context.checkActive(signal);
        return ['artifacts', 'refusal'].includes(envelope.kind)
          ? Buffer.alloc(0)
          : Buffer.from(JSON.stringify({ ...envelope, payload }));
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    finish(exitCode: number | null) {
      if (failed) return invalid();
      if (refusal) {
        if (exitCode !== 1) return invalid();
        throw refusal;
      }
      if (
        exitCode !== 0 ||
        !terminal ||
        !batch ||
        !pages ||
        preparedPages !== pages
      )
        return invalid();
      return { pageCount: pages, taskCount: taskIds.size };
    },
  };
}
