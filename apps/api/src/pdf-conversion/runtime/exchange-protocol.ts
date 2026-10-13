import { wordWrapExchangeTasks } from './word-wrap-exchange-tasks';
import { exchangeJson } from './exchange-json';
import { PdfRuntimeError } from './runtime-error';
import { exchangeTasks, type PendingExchangeTask } from './exchange-tasks';

export const MAX_EXCHANGE_FRAME = 24 * 1024 ** 2 + 1024;
export const MAX_EXCHANGE_REPLY = 64 * 1024 ** 2 + 1024;
export const MAX_EXCHANGE_REPLY_TOTAL = 64 * 1024 ** 2 + 25533 * 1024;
export type ExchangeBinding = { source_sha256: string; profile_id: string };
export type ExchangeEnvelope = ExchangeBinding & {
  schema_version:
    | 'ava-reconstruction-exchange-1'
    | 'ava-reconstruction-exchange-2'
    | 'ava-recognition-anchor-context-exchange-1'
    | 'ava-native-structure-exchange-1'
    | 'ava-recognition-geometry-exchange-1';
  sequence: number;
  kind:
    | 'page'
    | 'recognition'
    | 'native_structure'
    | 'anchor_context'
    | 'geometry'
    | 'word_wrap_batch'
    | 'word_wrap'
    | 'refinement_batch'
    | 'refinement'
    | 'artifacts'
    | 'refusal';
  payload: unknown;
};

export function exchangeProtocol(
  binding: ExchangeBinding,
  wordWrapMode = false,
  geometryMode = false,
) {
  let sequence = 0,
    pages = 0,
    recognitions = 0,
    refinements = 0,
    batch = false,
    wrapBatch = false,
    wraps = 0,
    terminal = false;
  let pending: PendingExchangeTask[] = [];
  let lastRecognition: string | undefined;
  const correctedParents = new Set<string>();
  return {
    get lastReply() {
      return (wordWrapMode ? wrapBatch : batch) && pending.length === 0;
    },
    accept(bytes: Buffer): ExchangeEnvelope {
      if (bytes.length > MAX_EXCHANGE_FRAME)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      const value = exchangeJson(bytes) as ExchangeEnvelope;
      const geometry =
        value?.schema_version === 'ava-recognition-geometry-exchange-1';
      const correction =
        value?.schema_version === 'ava-recognition-anchor-context-exchange-1';
      const native =
        value?.schema_version === 'ava-native-structure-exchange-1';
      if (
        !value ||
        Object.keys(value).sort().join() !==
          'kind,payload,profile_id,schema_version,sequence,source_sha256' ||
        (!correction &&
          !geometry &&
          !native &&
          value.schema_version !==
            (wordWrapMode
              ? 'ava-reconstruction-exchange-2'
              : 'ava-reconstruction-exchange-1')) ||
        correction !== (value.kind === 'anchor_context') ||
        geometry !== (value.kind === 'geometry') ||
        (geometry && (!geometryMode || !wordWrapMode)) ||
        native !== (value.kind === 'native_structure') ||
        !Number.isSafeInteger(value.sequence) ||
        value.sequence !== sequence + 1 ||
        value.sequence >
          (value.schema_version === 'ava-reconstruction-exchange-2' || geometry
            ? 25600
            : 25534) ||
        terminal ||
        typeof value.source_sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.source_sha256) ||
        !['ava-pdf-prose-en-v2', 'ava-pdf-prose-en-uk-v3'].includes(
          value.profile_id,
        ) ||
        ![
          'page',
          'recognition',
          'native_structure',
          'anchor_context',
          ...(geometryMode ? ['geometry'] : []),
          ...(wordWrapMode ? ['word_wrap_batch', 'word_wrap'] : []),
          'refinement_batch',
          'refinement',
          'artifacts',
          'refusal',
        ].includes(value.kind)
      )
        throw new PdfRuntimeError('INVALID_RESULT');
      if (
        value.source_sha256 !== binding.source_sha256 ||
        value.profile_id !== binding.profile_id
      )
        throw new PdfRuntimeError('SOURCE_MISMATCH');
      const limit =
        value.kind === 'page'
          ? 8 * 1024 ** 2 + 1024
          : value.kind === 'refinement_batch' ||
              value.kind === 'word_wrap_batch' ||
              correction ||
              geometry
            ? MAX_EXCHANGE_FRAME
            : value.kind === 'recognition' ||
                value.kind === 'native_structure' ||
                value.kind === 'refinement' ||
                value.kind === 'word_wrap'
              ? 1024
              : 256 * 1024 + 1024;
      if (bytes.length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
      if (value.kind === 'page') {
        if (batch || pending.length || pages >= 500)
          throw new PdfRuntimeError('INVALID_RESULT');
        const marker = (value.payload as { schema_version?: unknown } | null)
          ?.schema_version;
        if (
          wordWrapMode
            ? marker !== 'ava-prepare-result-4'
            : marker === 'ava-prepare-result-4'
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        pending = exchangeTasks(value.payload, 50);
        lastRecognition = undefined;
        pages++;
      } else if (value.kind === 'refinement_batch') {
        if (batch || !pages || pending.length)
          throw new PdfRuntimeError('INVALID_RESULT');
        pending = exchangeTasks(value.payload, 32, true);
        lastRecognition = undefined;
        batch = true;
      } else if (value.kind === 'word_wrap_batch') {
        if (!wordWrapMode || !batch || wrapBatch || pending.length)
          throw new PdfRuntimeError('INVALID_RESULT');
        pending = wordWrapExchangeTasks(value.payload);
        wrapBatch = true;
        lastRecognition = undefined;
      } else if (value.kind === 'word_wrap') {
        const task = value.payload as { task_id?: unknown } | null;
        if (
          !wrapBatch ||
          !pending.length ||
          !task ||
          Object.keys(task).join() !== 'task_id' ||
          task.task_id !== pending[0].id ||
          pending[0].kind !== 'word_wrap' ||
          wraps >= 32
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        pending.shift();
        wraps++;
      } else if (correction || geometry) {
        const task = value.payload as {
          task_id?: unknown;
          original_task_id?: unknown;
        } | null;
        if (
          batch ||
          !lastRecognition ||
          !task ||
          typeof task.task_id !== 'string' ||
          !task.task_id.length ||
          task.original_task_id !== lastRecognition ||
          correctedParents.has(lastRecognition)
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        correctedParents.add(lastRecognition);
        lastRecognition = undefined;
      } else if (
        value.kind === 'recognition' ||
        value.kind === 'native_structure' ||
        value.kind === 'refinement'
      ) {
        const task = value.payload as { task_id?: unknown } | null;
        if (
          (value.kind === 'refinement') !== batch ||
          !pending.length ||
          !task ||
          Object.keys(task).join() !== 'task_id' ||
          task.task_id !== pending[0].id ||
          value.kind !== pending[0].kind ||
          (value.kind !== 'refinement'
            ? recognitions >= 25000
            : refinements >= 32)
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        pending.shift();
        lastRecognition =
          value.kind === 'recognition' ? task.task_id : undefined;
        if (value.kind !== 'refinement') recognitions++;
        else refinements++;
      } else {
        if (
          value.kind === 'artifacts' &&
          (!batch ||
            (wordWrapMode && !wrapBatch) ||
            pending.length ||
            value.payload !== null)
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        terminal = true;
      }
      sequence++;
      return value;
    },
  };
}

export function exchangeReply(bytes: Buffer, request: ExchangeEnvelope) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 1 ||
    bytes.length > MAX_EXCHANGE_REPLY
  )
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const value = exchangeJson(bytes) as ExchangeEnvelope;
  const count = [
    'recognition',
    'native_structure',
    'word_wrap',
    'refinement',
    'anchor_context',
    'geometry',
  ].includes(request.kind)
    ? 1
    : 0;
  if (
    !value ||
    Object.keys(value).sort().join() !== Object.keys(request).sort().join() ||
    value.schema_version !== request.schema_version ||
    value.sequence !== request.sequence ||
    value.source_sha256 !== request.source_sha256 ||
    value.profile_id !== request.profile_id ||
    value.kind !== request.kind ||
    !Array.isArray(value.payload) ||
    value.payload.length !== count
  )
    throw new PdfRuntimeError('INVALID_RESULT');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  return Buffer.concat([header, bytes]);
}
