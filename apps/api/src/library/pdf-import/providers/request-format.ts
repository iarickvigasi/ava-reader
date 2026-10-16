import { PdfProviderError } from './errors';
import { providerResponseSchema } from './response-schema';
import type { ProviderTask } from './types';
import {
  recognitionObservationSchema,
  recognitionObservationSystem,
} from './recognition-observation-contract';
import { recognitionObservationDecoder } from './recognition-observation-output';

// JSON mode avoids Gemini's provider-side complex-schema compiler. The unchanged
// canonical schema and source-bound host/worker checks still decide acceptance.
export function providerRequestFormat(modelId: string, task: ProviderTask) {
  const schema = providerResponseSchema(modelId, task);
  if (
    !modelId.startsWith('google/gemini-') ||
    !['ava-native-structure-response-2', 'ava-recognition-response-2'].includes(
      task.schemaVersion,
    )
  )
    return {
      messages: task.messages,
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'ava_pdf_result', strict: true, schema },
      },
    };
  const images = task.messages.flatMap((message) =>
    typeof message.content === 'string'
      ? []
      : message.content.filter((part) => part.type === 'image_url'),
  );
  if (images.length !== 1)
    throw new PdfProviderError('PDF_PROVIDER_REQUEST_INVALID');
  const recognition = task.schemaVersion === 'ava-recognition-response-2';
  const decodeOutput = recognition
    ? recognitionObservationDecoder(task)
    : undefined;
  const guidance = {
    type: 'text' as const,
    text:
      'Host response contract for the requested JSON object. This is output-format guidance, not PDF source content. Return only one JSON object matching this schema; do not copy the schema into the response.' +
      (task.schemaVersion === 'ava-recognition-response-2'
        ? ' SELF-CHECK: Every segment must include kind and all required fields. Optional does not mean nullable: omit inapplicable optional fields; never emit alt:null. EVERY figure requires its own alt string describing visible content and relationships, even when text already contains its internal labels. Do not omit alt, copy a caption as its description, or label an informational figure decorative. Finalize each owning text first, then verify every anchor quotation matches uniquely with exact immediately adjacent before/after context, including spaces and newlines. Omit context or use empty strings when the quotation is already unique. Never alter source text or erase observations to pass validation.'
        : '') +
      '\n' +
      JSON.stringify(
        task.schemaVersion === 'ava-recognition-response-2'
          ? recognitionObservationSchema()
          : schema,
      ),
  };
  return {
    decodeOutput,
    messages: task.messages.map((message) =>
      recognition &&
      message.role === 'system' &&
      typeof message.content === 'string'
        ? { ...message, content: recognitionObservationSystem(message.content) }
        : message.role === 'user' && typeof message.content !== 'string'
          ? { ...message, content: [guidance, ...message.content] }
          : message,
    ),
    responseFormat: { type: 'json_object' },
  };
}
