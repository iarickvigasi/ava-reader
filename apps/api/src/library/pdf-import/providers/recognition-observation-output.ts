import { exchangeJson } from '../../../pdf-conversion/runtime/exchange-json';
import { recognitionResponse } from '../../../pdf-conversion/reconstruction/recognition-response';
import { PdfProviderError } from './errors';
import { RECOGNITION_OBSERVATION_WIRE } from './recognition-observation-contract';
import { recognitionObservationTask } from './recognition-observation-task';
import type { ProviderTask } from './types';
import { projectObservationStyles } from './recognition-observation-styles';
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const refuse = (): never => {
  throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
};
// A per-preparation closure: route/request reuse fencing happens before it is called.
export function recognitionObservationDecoder(task: ProviderTask) {
  const trusted = recognitionObservationTask(task);
  return (output: string): string => {
    const bytes = Buffer.from(output);
    if (bytes.length > 8 * 1024 ** 2 || bytes.toString('utf8') !== output)
      return refuse();
    let raw: unknown;
    try {
      raw = exchangeJson(bytes);
    } catch {
      return refuse();
    }
    if (
      !record(raw) ||
      raw.schema_version !== RECOGNITION_OBSERVATION_WIRE ||
      ['task_id', 'source_sha256', 'render_sha256'].some((key) =>
        Object.hasOwn(raw, key),
      ) ||
      !Array.isArray(raw.segments) ||
      raw.segments.some(
        (segment: unknown) =>
          !record(segment) || Object.hasOwn(segment, 'page'),
      )
    )
      return refuse();
    projectObservationStyles(raw);
    const canonical = {
      ...raw,
      schema_version: trusted.response_schema_version,
      task_id: trusted.task_id,
      source_sha256: trusted.source_sha256,
      render_sha256: trusted.image.sha256,
      segments: raw.segments.map((segment: Record<string, unknown>) => ({
        ...segment,
        // This decoder is bound to an exact recognition task. OCR is its fixed
        // provenance, not a model judgment. Preserve explicit values so conflicts
        // and null still fail the unchanged canonical contract.
        method: Object.hasOwn(segment, 'method') ? segment.method : 'ocr',
        page: trusted.page_number,
      })),
    };
    return JSON.stringify(
      recognitionResponse(trusted, JSON.stringify(canonical)),
    );
  };
}
export function decodeProviderReceipt<T extends { output: string }>(
  receipt: T,
  decode: ((output: string) => string) | undefined,
): T {
  return decode ? { ...receipt, output: decode(receipt.output) } : receipt;
}
