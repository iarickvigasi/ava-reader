import {
  preparedAttemptPage,
  type PreparedAttemptPage,
} from './prepared-attempt-page';
import { observeAttemptPage } from './observe-attempt-page';
import { resolveNativeStructureAttemptTask } from './native-structure-attempt';
import {
  type RefinementResponse,
  type RefinementBatchPacket,
  validateRefinementBatch,
} from './refinement-packets';
import type { ExchangeEnvelope } from '../runtime/exchange-protocol';
import { exchangeProtocol } from '../runtime/exchange-protocol';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { reconstructionRequest } from './reconstruction-request';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import { anchorContextBinding } from './anchor-context-binding';
import { parseSourceRefusal, type SourceContentError } from './source-refusal';
import {
  recognizeAttemptTask,
  refineAttemptTask,
  correctAttemptAnchorContext,
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
  const nativeStructureResponses: NativeStructureResponse[] = [];
  const refinements: RefinementResponse[] = [];
  const correctionIds = new Set<string>();
  let correctionUnresolved = false;
  let lastOriginal:
    | {
        task: RecognitionTask;
        response: RecognitionResponse;
        index: number;
      }
    | undefined;
  let currentPage: PreparedAttemptPage | undefined,
    pages: number | undefined,
    preparedPages = 0,
    pageTaskIndex = 0,
    responseBytes = context.sourceStructurePolicy ? 4 : 2,
    batch: RefinementBatchPacket | undefined,
    refinementIndex = 0,
    failed = false,
    handling = false,
    terminal = false,
    refusal: SourceContentError | PdfRuntimeError | undefined;
  const invalid = () => {
    throw new PdfRuntimeError('INVALID_RESULT');
  };
  const completePage = async (signal: AbortSignal) => {
    if (!currentPage) return;
    if (pageTaskIndex !== currentPage.tasks.length) invalid();
    context.checkActive(signal);
    await context.deps.progress({
      stage: 'EXTRACTION',
      completed: currentPage.page_number,
      total: pages,
    });
  };
  const reconstructionInput = () =>
    reconstructionRequest(
      context,
      responses,
      refinements,
      batch?.schema_version === 'ava-book-refinement-batch-2',
      nativeStructureResponses,
    );
  const inputBound = () => {
    if (
      Buffer.byteLength(JSON.stringify(reconstructionInput())) >
      64 * 1024 ** 2
    )
      throw new PdfRuntimeError('RESOURCE_LIMIT');
  };
  const retainResponse = (
    response: RecognitionResponse | NativeStructureResponse,
  ) => {
    const priorCount =
      response.schema_version === 'ava-native-structure-response-1'
        ? nativeStructureResponses.length
        : responses.length;
    responseBytes +=
      Buffer.byteLength(JSON.stringify(response)) + (priorCount ? 1 : 0);
    if (
      responseBytes > 60 * 1024 ** 2 ||
      responses.length + nativeStructureResponses.length >= 25000
    )
      throw new PdfRuntimeError('RESOURCE_LIMIT');
  };
  async function handle(
    envelope: ExchangeEnvelope,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    if (correctionUnresolved && envelope.kind !== 'refusal') return invalid();
    if (envelope.kind === 'page') {
      lastOriginal = undefined;
      const prepared = preparedAttemptPage(envelope.payload, context, {
        preparedPages,
        pages,
        batch: !!batch,
      });
      const tasks = prepared.tasks;
      if (prepared.tasks.length && context.providerMode === 'native')
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      for (const task of tasks) {
        if (taskIds.has(task.task_id)) invalid();
        taskIds.add(task.task_id);
      }
      await completePage(signal);
      pages = prepared.source_page_count;
      currentPage = prepared;
      pageTaskIndex = 0;
      preparedPages++;
      observeAttemptPage(prepared, context, pages);
      return [];
    }
    if (
      envelope.kind === 'recognition' ||
      envelope.kind === 'native_structure'
    ) {
      lastOriginal = undefined;
      const task = currentPage?.tasks[pageTaskIndex];
      if (
        batch ||
        !task ||
        (envelope.payload as { task_id: string }).task_id !== task.task_id
      )
        return invalid();
      if (
        (task.schema_version === 'ava-native-structure-task-1') !==
        (envelope.kind === 'native_structure')
      )
        return invalid();
      if (task.schema_version === 'ava-native-structure-task-1') {
        const response = await resolveNativeStructureAttemptTask(
          task,
          context,
          signal,
        );
        if (failed) return invalid();
        retainResponse(response);
        nativeStructureResponses.push(response);
        pageTaskIndex++;
        return [response];
      }
      const response = await recognizeAttemptTask(task, context, signal);
      if (failed) return invalid();
      retainResponse(response);
      responses.push(response);
      lastOriginal = { task, response, index: responses.length - 1 };
      pageTaskIndex++;
      return [response];
    }
    if (envelope.kind === 'anchor_context') {
      if (
        !lastOriginal ||
        batch ||
        context.providerMode === 'native' ||
        context.sourceLayoutPolicy !== 'ava-native-layout-1'
      )
        return invalid();
      const parent = lastOriginal;
      const task = anchorContextBinding(
        envelope.payload,
        parent.task,
        parent.response,
      );
      if (taskIds.has(task.task_id) || correctionIds.has(task.task_id))
        return invalid();
      // Consume the one opportunity before dispatch, including WAIT/uncertain failures.
      lastOriginal = undefined;
      correctionIds.add(task.task_id);
      const result = await correctAttemptAnchorContext(
        task,
        parent.task,
        parent.response,
        {
          ...context,
          checkActive: (activeSignal) => {
            if (failed) return invalid();
            context.checkActive(activeSignal);
          },
        },
        signal,
      );
      if (failed) return invalid();
      if (!result.corrected) {
        correctionUnresolved = true;
        return [result.response];
      }
      responseBytes +=
        Buffer.byteLength(JSON.stringify(result.corrected)) -
        Buffer.byteLength(JSON.stringify(parent.response));
      if (responseBytes > 60 * 1024 ** 2)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      responses[parent.index] = result.corrected;
      inputBound();
      return [result.response];
    }
    if (envelope.kind === 'refinement_batch') {
      lastOriginal = undefined;
      if (batch || !pages || preparedPages !== pages) return invalid();
      const prepared = validateRefinementBatch(envelope.payload);
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
      if (
        refinements.filter(
          (r) => r.schema_version === 'ava-printed-title-response-1',
        ).length !==
        (batch.schema_version === 'ava-book-refinement-batch-2' ? 1 : 0)
      )
        invalid();
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
      if (failed || handling) {
        failed = true;
        return invalid();
      }
      handling = true;
      try {
        context.checkActive(signal);
        const envelope = protocol.accept(bytes);
        if (
          envelope.source_sha256 !== context.sourceSha256 ||
          envelope.profile_id !== context.profileId
        )
          throw new PdfRuntimeError('SOURCE_MISMATCH');
        const payload = await handle(envelope, signal);
        if (failed) return invalid();
        context.checkActive(signal);
        return ['artifacts', 'refusal'].includes(envelope.kind)
          ? Buffer.alloc(0)
          : Buffer.from(JSON.stringify({ ...envelope, payload }));
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        handling = false;
      }
    },
    finish(exitCode: number | null) {
      if (handling) {
        failed = true;
        return invalid();
      }
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
