import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';

const candidatePacket = z
  .object({
    schema_version: z.literal('ava-recognition-overflow-candidate-1'),
    task_id: z.string(),
    source_sha256: z.string(),
    original_response_json: z.string().max(8 * 1024 ** 2),
    original_response_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

export function overflowCandidatePacket(
  task: RecognitionTask,
  response: RecognitionResponse,
): string {
  const original = JSON.stringify(response),
    packet = JSON.stringify(
      candidatePacket.parse({
        schema_version: 'ava-recognition-overflow-candidate-1',
        task_id: task.task_id,
        source_sha256: task.source_sha256,
        original_response_json: original,
        original_response_sha256: hash(original),
      }),
    );
  if (Buffer.byteLength(packet) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  return packet;
}

export function unwrapOverflowCandidate(
  task: RecognitionTask,
  output: string,
): string {
  if (Buffer.from(output).toString('utf8') !== output)
    throw new PdfRuntimeError('INVALID_RESULT');
  const raw = exchangeJson(Buffer.from(output));
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('schema_version' in raw) ||
    raw.schema_version !== 'ava-recognition-overflow-candidate-1'
  )
    return output;
  const packet = candidatePacket.parse(raw);
  if (
    packet.task_id !== task.task_id ||
    packet.source_sha256 !== task.source_sha256 ||
    packet.original_response_sha256 !== hash(packet.original_response_json)
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  return packet.original_response_json;
}
