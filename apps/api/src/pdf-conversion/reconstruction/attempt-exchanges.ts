import { currentRefinementMode } from '../runtime/refinement-frame-budget';
import { requiresContinuation } from './anchor-quote-types';
import { validatePacket } from './validate-packet';
import {
  NATIVE_STRUCTURE_V2_POLICY,
  SOURCE_CONTINUATION_POLICY,
} from '../../library/pdf-import/admission/profile';
import type { NativeStructureResponse2 } from './generated/NativeStructureResponse2';
import type { AnyGeometryProof } from './geometry-types';
import { cellGeometryBinding } from './cell-geometry-binding';
import { geometryBinding, geometrySha } from './geometry-binding';
import {
  preparedAttemptPage,
  type PreparedAttemptPage,
} from './prepared-attempt-page';
import { wordWrapAttempt } from './word-wrap-attempt';
import type { WordWrapResponse } from './generated/WordWrapResponse';
import { observeAttemptPage } from './observe-attempt-page';
import { resolveNativeStructureAttemptTask } from './native-structure-attempt';
import {
  type RefinementResponse,
  type RefinementTask,
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
import { anchorQuoteBinding } from './anchor-context-binding';
import { anchorRepairBinding } from './anchor-repair-binding';
import { parseSourceRefusal, type SourceContentError } from './source-refusal';
import {
  recognizeAttemptReceipt,
  correctAttemptGeometry,
  refineAttemptTask,
  correctAttemptAnchorContext,
  type AttemptContext,
} from './attempt-provider';

// The worker accepts each response before requesting another task. Keeping that
// round trip prevents spending on later tasks after an invalid earlier response.
export function attemptExchanges(context: AttemptContext) {
  const protocol = exchangeProtocol(
    {
      source_sha256: context.sourceSha256,
      profile_id: context.profileId,
    },
    !!context.sourceNormalizationPolicy,
    !!context.recognitionRepairPolicy,
    context.sourceStructurePolicy === NATIVE_STRUCTURE_V2_POLICY,
    currentRefinementMode(context),
  );
  const taskIds = new Set<string>();
  const responses: RecognitionResponse[] = [];
  const nativeStructureResponses: (
    | NativeStructureResponse
    | NativeStructureResponse2
  )[] = [];
  const refinements: RefinementResponse[] = [];
  const geometryCorrections: AnyGeometryProof[] = [];
  const correctionIds = new Set<string>();
  let correctionUnresolved = false;
  let pendingOverflow = false;
  let lastOriginal:
    | {
        task: RecognitionTask;
        response: RecognitionResponse;
        index: number;
        originalResponseJson: string;
      }
    | undefined;
  let currentPage: PreparedAttemptPage | undefined,
    pages: number | undefined,
    preparedPages = 0,
    pageTaskIndex = 0,
    responseBytes = context.recognitionRepairPolicy
      ? 8
      : context.sourceNormalizationPolicy
        ? 6
        : context.sourceStructurePolicy
          ? 4
          : 2,
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
      wordWrap.responses,
      geometryCorrections,
    );
  const inputBound = () => {
    if (
      Buffer.byteLength(JSON.stringify(reconstructionInput())) >
      64 * 1024 ** 2
    )
      throw new PdfRuntimeError('RESOURCE_LIMIT');
  };
  const retainResponse = (
    response:
      | RecognitionResponse
      | NativeStructureResponse
      | NativeStructureResponse2
      | WordWrapResponse,
  ) => {
    const priorCount =
      response.schema_version === 'ava-native-word-wrap-response-1'
        ? wordWrap.responses.length
        : response.schema_version === 'ava-native-structure-response-1' ||
            response.schema_version === 'ava-native-structure-response-2'
          ? nativeStructureResponses.length
          : responses.length;
    responseBytes +=
      Buffer.byteLength(JSON.stringify(response)) + (priorCount ? 1 : 0);
    if (
      responseBytes > 60 * 1024 ** 2 ||
      (response.schema_version !== 'ava-native-word-wrap-response-1' &&
        responses.length + nativeStructureResponses.length >= 25000)
    )
      throw new PdfRuntimeError('RESOURCE_LIMIT');
  };
  const wordWrap = wordWrapAttempt(
    {
      ...context,
      checkActive: (signal) => {
        if (failed) invalid();
        context.checkActive(signal);
      },
    },
    (id) =>
      taskIds.has(id) ||
      correctionIds.has(id) ||
      !!batch?.tasks.some((task) => task.task_id === id),
    retainResponse,
  );
  async function handle(
    envelope: ExchangeEnvelope,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    if (correctionUnresolved && envelope.kind !== 'refusal') return invalid();
    if (
      pendingOverflow &&
      !['anchor_context', 'refusal'].includes(envelope.kind)
    )
      return invalid();
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
        (task.schema_version === 'ava-native-structure-task-1' ||
          task.schema_version === 'ava-native-structure-task-2') !==
        (envelope.kind === 'native_structure')
      )
        return invalid();
      if (
        task.schema_version === 'ava-native-structure-task-1' ||
        task.schema_version === 'ava-native-structure-task-2'
      ) {
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
      const receipt = await recognizeAttemptReceipt(task, context, signal);
      const { response, originalResponseJson } = receipt;
      pendingOverflow = receipt.pendingOverflow;
      if (failed) return invalid();
      retainResponse(response);
      responses.push(response);
      lastOriginal = {
        task,
        response,
        index: responses.length - 1,
        originalResponseJson,
      };
      pageTaskIndex++;
      return context.recognitionRepairPolicy
        ? [
            {
              schema_version: 'ava-recognition-attempt-reply-1',
              response,
              original_response_json: originalResponseJson,
              original_response_sha256: geometrySha(originalResponseJson),
            },
          ]
        : [response];
    }
    if (envelope.kind === 'geometry') {
      if (
        !lastOriginal ||
        batch ||
        context.providerMode === 'native' ||
        ![
          'ava-recognition-geometry-repair-1',
          'ava-recognition-geometry-repair-2',
        ].includes(context.recognitionRepairPolicy ?? '')
      )
        return invalid();
      const parent = lastOriginal;
      const cell =
        (envelope.payload as { schema_version?: unknown })?.schema_version ===
        'ava-recognition-cell-geometry-task-1';
      if (
        cell &&
        context.recognitionRepairPolicy !== 'ava-recognition-geometry-repair-2'
      )
        return invalid();
      const task = (cell ? cellGeometryBinding : geometryBinding)(
        envelope.payload,
        parent.task,
        parent.response,
        parent.originalResponseJson,
      );
      if (taskIds.has(task.task_id) || correctionIds.has(task.task_id))
        return invalid();
      lastOriginal = undefined;
      correctionIds.add(task.task_id);
      const result = await correctAttemptGeometry(
        task,
        parent.task,
        parent.response,
        parent.originalResponseJson,
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
      const proofFields = {
        original_response_json: parent.originalResponseJson,
        original_response_sha256: geometrySha(parent.originalResponseJson),
        response: result.response,
      };
      const proof =
        result.response.schema_version ===
        'ava-recognition-cell-geometry-response-1'
          ? validatePacket('RecognitionCellGeometryProof', proofFields)
          : validatePacket('RecognitionGeometryProof', proofFields);
      responseBytes +=
        Buffer.byteLength(JSON.stringify(result.corrected)) -
        Buffer.byteLength(JSON.stringify(parent.response)) +
        Buffer.byteLength(JSON.stringify(proof)) +
        (geometryCorrections.length ? 1 : 0);
      if (responseBytes > 60 * 1024 ** 2)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      geometryCorrections.push(proof);
      responses[parent.index] = result.corrected;
      inputBound();
      return [result.response];
    }
    if (
      envelope.kind === 'anchor_context' ||
      envelope.kind === 'anchor_quote'
    ) {
      if (
        !lastOriginal ||
        batch ||
        context.providerMode === 'native' ||
        context.sourceLayoutPolicy !== 'ava-native-layout-1'
      )
        return invalid();
      const parent = lastOriginal;
      if (
        pendingOverflow &&
        (envelope.payload as { schema_version?: unknown })?.schema_version !==
          'ava-recognition-anchor-context-task-2'
      )
        return invalid();
      const task = (
        envelope.kind === 'anchor_quote'
          ? anchorQuoteBinding
          : anchorRepairBinding
      )(envelope.payload, parent.task, parent.response);
      if (
        requiresContinuation(task) &&
        (context.recognitionRepairPolicy !==
          'ava-recognition-geometry-repair-2' ||
          context.sourceContinuationPolicy !== SOURCE_CONTINUATION_POLICY)
      )
        return invalid();
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
      pendingOverflow = false;
      inputBound();
      return [result.response];
    }
    if (envelope.kind === 'refinement_batch') {
      lastOriginal = undefined;
      if (batch || !pages || preparedPages !== pages) return invalid();
      const prepared = validateRefinementBatch(envelope.payload);
      if (
        context.sourceContinuationPolicy
          ? prepared.schema_version !== 'ava-book-refinement-batch-4' ||
            prepared.source_continuation_policy !==
              context.sourceContinuationPolicy ||
            prepared.source_title_policy !== context.sourceTitlePolicy
          : prepared.schema_version === 'ava-book-refinement-batch-4' ||
            (context.sourceTitlePolicy
              ? prepared.schema_version !== 'ava-book-refinement-batch-3' ||
                prepared.source_title_policy !== context.sourceTitlePolicy
              : prepared.schema_version === 'ava-book-refinement-batch-3')
      )
        throw new PdfRuntimeError('DISPATCH_NOT_AUTHORIZED');
      const tasks: RefinementTask[] = prepared.tasks;
      if (
        prepared.source_sha256 !== context.sourceSha256 ||
        tasks.some(
          (task) =>
            task.source_sha256 !== context.sourceSha256 ||
            task.profile_id !== context.profileId ||
            (task.schema_version === 'ava-printed-title-task-2' &&
              task.source_page_count !== pages),
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
    if (envelope.kind === 'word_wrap_batch') {
      lastOriginal = undefined;
      if (
        !batch ||
        !pages ||
        refinementIndex !== batch.tasks.length ||
        preparedPages !== pages
      )
        return invalid();
      wordWrap.accept(envelope.payload, pages);
      inputBound();
      return [];
    }
    if (envelope.kind === 'word_wrap') {
      const response = await wordWrap.resolve(
        (envelope.payload as { task_id: string }).task_id,
        signal,
      );
      if (failed) return invalid();
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
      if (
        refinements.filter(
          (r) => r.schema_version === 'ava-printed-title-response-2',
        ).length !==
        (batch.schema_version === 'ava-book-refinement-batch-3' ||
        batch.schema_version === 'ava-book-refinement-batch-4'
          ? batch.tasks.filter(
              (task) => task.schema_version === 'ava-printed-title-task-2',
            ).length
          : 0)
      )
        invalid();
      wordWrap.complete();
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
        pendingOverflow ||
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
