import { requireJsonScalars } from '../runtime/json-scalars';
import type { RecognitionTask } from './generated/RecognitionTask';
import type { RecognitionResponse } from './generated/RecognitionResponse';
import { exchangeJson } from '../runtime/exchange-json';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { recognitionResponse } from './recognition-response';

// This is a worker-only raw candidate, never canonical acceptance or a reconstruction shortcut.
// Only overlong context strings are masked in a closed shape probe, then restored verbatim.
export function overflowRecognitionCandidate(
  task: RecognitionTask,
  output: string,
): RecognitionResponse {
  requireJsonScalars(output);
  if (Buffer.byteLength(output) > 8 * 1024 ** 2)
    throw new PdfRuntimeError('RESOURCE_LIMIT');
  const raw = exchangeJson(Buffer.from(output)) as RecognitionResponse;
  requireJsonScalars(raw);
  if (!raw || !Array.isArray(raw.segments))
    throw new PdfRuntimeError('INVALID_RESULT');
  const probe = structuredClone(raw),
    changed: {
      segment: number;
      span: number;
      key: 'before' | 'after';
      value: string;
    }[] = [];
  raw.segments.forEach((segment, i) => {
    if (!segment || !Array.isArray(segment.spans))
      throw new PdfRuntimeError('INVALID_RESULT');
    segment.spans.forEach((span, j) => {
      for (const key of ['before', 'after'] as const) {
        const value = span?.anchor?.[key];
        if (typeof value !== 'string' || Array.from(value).length <= 128)
          continue;
        if (
          Array.from(value).length > 4096 ||
          !span.style ||
          span.start != null ||
          span.end != null ||
          span.url != null ||
          span.note_label != null ||
          span.target_text != null ||
          typeof segment.text !== 'string' ||
          !segment.text.includes(span.anchor!.exact_text)
        )
          throw new PdfRuntimeError('INVALID_RESULT');
        probe.segments[i].spans[j].anchor![key] = '';
        changed.push({ segment: i, span: j, key, value });
      }
    });
  });
  if (!changed.length) throw new PdfRuntimeError('INVALID_RESULT');
  const candidate = recognitionResponse(task, JSON.stringify(probe));
  for (const item of changed)
    candidate.segments[item.segment].spans[item.span].anchor![item.key] =
      item.value;
  return candidate;
}
