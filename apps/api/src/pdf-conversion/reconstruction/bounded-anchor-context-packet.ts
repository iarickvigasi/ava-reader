import { exchangeJson } from '../runtime/exchange-json';
import { requireJsonScalars } from '../runtime/json-scalars';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { validatePacket } from './validate-packet';
import { proveAnchorContextProjection } from './prove-anchor-context-projection';
import type { RecognitionAnchorContextTask } from './generated/RecognitionAnchorContextTask';
import type { RecognitionAnchorContextResponse } from './generated/RecognitionAnchorContextResponse';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import type { AnchorContextProjection } from './anchor-context-projection-evidence';

// This adapter handles only context-task-1. The original receipt never becomes a compliant raw reply.
export function boundedAnchorContextPacket(
  task: RecognitionAnchorContextTask,
  output: string,
  parent: RecognitionTask,
  original: RecognitionResponse,
): {
  response: RecognitionAnchorContextResponse;
  projection?: AnchorContextProjection;
} {
  if (Buffer.byteLength(output) > 2 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  requireJsonScalars(output);
  const raw = exchangeJson(Buffer.from(output));
  requireJsonScalars(raw);
  const probe = structuredClone(raw) as { patches?: unknown } | null;
  const changed = new Set<number>();
  if (Array.isArray(probe?.patches))
    probe.patches.forEach((patch: unknown, index: number) => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return;
      const fields = patch as Record<string, unknown>;
      for (const key of ['before', 'after'] as const) {
        const value = fields[key];
        if (typeof value !== 'string') continue; // The closed schema rejects wrong types, never masks them.
        const chars = Array.from(value);
        if (chars.length > 4096) throw new PdfRuntimeError('INVALID_RESULT');
        if (chars.length <= 128) continue;
        fields[key] = (
          key === 'before' ? chars.slice(-128) : chars.slice(0, 128)
        ).join('');
        changed.add(index);
      }
    });
  // All fields except string context bounds are validated by the unchanged complete closed schema.
  const response = validatePacket('RecognitionAnchorContextResponse', probe);
  if (!changed.size) return { response };
  const projection = proveAnchorContextProjection(
    task,
    parent,
    original,
    output,
    raw as RecognitionAnchorContextResponse,
    response,
    changed,
  );
  return { response, projection };
}
