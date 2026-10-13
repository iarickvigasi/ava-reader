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
    | 'ava-recognition-anchor-context-exchange-1'
    | 'ava-native-structure-exchange-1';
  sequence: number;
  kind:
    | 'page'
    | 'recognition'
    | 'native_structure'
    | 'anchor_context'
    | 'refinement_batch'
    | 'refinement'
    | 'artifacts'
    | 'refusal';
  payload: unknown;
};

export function exchangeProtocol(binding: ExchangeBinding) {
  let sequence = 0,
    pages = 0,
    recognitions = 0,
    refinements = 0,
    batch = false,
    terminal = false;
  let pending: PendingExchangeTask[] = [];
  let lastRecognition: string | undefined;
  const correctedParents = new Set<string>();
  return {
    get lastReply() {
      return batch && pending.length === 0;
    },
    accept(bytes: Buffer): ExchangeEnvelope {
      if (bytes.length > MAX_EXCHANGE_FRAME)
        throw new PdfRuntimeError('RESOURCE_LIMIT');
      const value = exchangeJson(bytes) as ExchangeEnvelope;
      const correction =
        value?.schema_version === 'ava-recognition-anchor-context-exchange-1';
      const native =
        value?.schema_version === 'ava-native-structure-exchange-1';
      if (
        !value ||
        Object.keys(value).sort().join() !==
          'kind,payload,profile_id,schema_version,sequence,source_sha256' ||
        (!correction &&
          !native &&
          value.schema_version !== 'ava-reconstruction-exchange-1') ||
        correction !== (value.kind === 'anchor_context') ||
        native !== (value.kind === 'native_structure') ||
        !Number.isSafeInteger(value.sequence) ||
        value.sequence !== sequence + 1 ||
        value.sequence > 25534 ||
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
          : value.kind === 'refinement_batch' || correction
            ? MAX_EXCHANGE_FRAME
            : value.kind === 'recognition' ||
                value.kind === 'native_structure' ||
                value.kind === 'refinement'
              ? 1024
              : 256 * 1024 + 1024;
      if (bytes.length > limit) throw new PdfRuntimeError('RESOURCE_LIMIT');
      if (value.kind === 'page') {
        if (batch || pending.length || pages >= 500)
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
      } else if (correction) {
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
          (!batch || pending.length || value.payload !== null)
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
    'refinement',
    'anchor_context',
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
