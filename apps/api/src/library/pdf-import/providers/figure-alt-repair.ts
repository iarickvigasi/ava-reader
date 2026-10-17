import Ajv from 'ajv';
import { exchangeJson } from '../../../pdf-conversion/runtime/exchange-json';
import { checksumBuffer } from '../../../shared/blob-utils';
import { jsonHash } from './hash';
import { recognitionObservationTask } from './recognition-observation-task';
import { PdfProviderError } from './errors';
import type { ProviderTask } from './types';
import {
  FIGURE_ALT_PROMPT,
  FIGURE_ALT_PROMPT_VERSION,
  FIGURE_ALT_SCHEMA,
  FIGURE_ALT_SCHEMA_VERSION,
} from './figure-alt-contract';
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const hash = (s: string) => checksumBuffer(Buffer.from(s));
type PatchResponse = {
  task_id: string;
  parent_output_sha256: string;
  outcome: 'described' | 'unresolved';
  patches: { segment_id: string; alt: string }[];
};
const validate = new Ajv({ strict: false }).compile<PatchResponse>(
  FIGURE_ALT_SCHEMA,
);

// Pure eligibility and projection. No default description ever leaves this function.
// Dispatch remains separately authorized and charged by the normal provider ledger.
export function prepareFigureAltRepair(
  task: ProviderTask,
  output: string,
  parent: { callId: string; requestSha256: string },
  decode: (s: string) => string,
) {
  const bytes = Buffer.from(output);
  if (bytes.length > 8 * 1024 ** 2 || bytes.toString('utf8') !== output)
    throw new Error('INELIGIBLE');
  const trusted = recognitionObservationTask(task);
  const raw: unknown = exchangeJson(bytes);
  if (!record(raw) || !Array.isArray(raw.segments))
    throw new Error('INELIGIBLE');
  const segments: Record<string, unknown>[] = [];
  const ids = new Set<string>();
  for (const segment of raw.segments) {
    if (
      !record(segment) ||
      typeof segment.id !== 'string' ||
      ids.has(segment.id)
    )
      throw new Error('INELIGIBLE');
    ids.add(segment.id);
    segments.push(segment);
  }
  const slots = segments.flatMap((s, index) =>
    s.kind === 'figure' && !Object.hasOwn(s, 'alt')
      ? [{ index, segment_id: s.id as string }]
      : [],
  );
  if (!slots.length || slots.length > 8) throw new Error('INELIGIBLE');
  const probe = structuredClone(raw) as typeof raw & {
    segments: Record<string, unknown>[];
  };
  for (const slot of slots) probe.segments[slot.index].alt = 'eligibility-only';
  // All other host schema, wire, source binding and refusal checks must pass.
  // This probe is discarded; it is never persisted, returned, or accepted by the worker.
  decode(JSON.stringify(probe));
  const lineage = {
    parent_call_id: parent.callId,
    parent_request_sha256: parent.requestSha256,
    parent_task_sha256: jsonHash(task),
    parent_output_sha256: hash(output),
    source_sha256: task.sourceSha256,
    render_sha256: trusted.image.sha256,
    page_number: trusted.page_number,
    figures: slots.map((s) => ({
      segment_id: s.segment_id,
      box: segments[s.index].box,
      observed_text: segments[s.index].text,
    })),
  };
  const taskId =
    'figure-alt-' +
    jsonHash({ version: FIGURE_ALT_PROMPT_VERSION, ...lineage });
  const correction: ProviderTask = {
    taskId,
    purpose: 'resolve_structure',
    sourceSha256: task.sourceSha256,
    pageIndices: [...task.pageIndices],
    promptVersion: FIGURE_ALT_PROMPT_VERSION,
    schemaVersion: FIGURE_ALT_SCHEMA_VERSION,
    responseSchema: FIGURE_ALT_SCHEMA,
    maxOutputTokens: Math.min(task.maxOutputTokens ?? 4096, 4096),
    messages: [
      { role: 'system', content: FIGURE_ALT_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task_id: taskId,
              language: raw.language,
              ...lineage,
            }),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${trusted.image.media_type};base64,${trusted.image.base64}`,
            },
          },
        ],
      },
    ],
  };
  return {
    task: correction,
    apply: (answer: string): string => {
      const answerBytes = Buffer.from(answer);
      if (
        answerBytes.length > 64 * 1024 ||
        answerBytes.toString('utf8') !== answer
      )
        throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
      const response: unknown = exchangeJson(answerBytes);
      if (
        !validate(response) ||
        response.task_id !== taskId ||
        response.parent_output_sha256 !== lineage.parent_output_sha256 ||
        response.outcome !== 'described' ||
        response.patches.length !== slots.length ||
        response.patches.some(
          (p, i) =>
            p.segment_id !== slots[i].segment_id ||
            !p.alt.trim() ||
            Buffer.from(p.alt).toString('utf8') !== p.alt,
        )
      )
        throw new PdfProviderError('PDF_PROVIDER_OUTPUT_INVALID');
      const patched = structuredClone(raw) as typeof raw & {
        segments: Record<string, unknown>[];
      };
      for (const [index, slot] of slots.entries())
        patched.segments[slot.index].alt = response.patches[index].alt;
      return decode(JSON.stringify(patched));
    },
  };
}
