import { PdfProviderError } from './errors';
import { providerResponseSchema } from './response-schema';
import type { ProviderTask } from './types';

// JSON mode avoids Gemini's provider-side complex-schema compiler. The unchanged
// canonical schema and source-bound host/worker checks still decide acceptance.
export function providerRequestFormat(modelId: string, task: ProviderTask) {
  const schema = providerResponseSchema(modelId, task);
  if (
    !modelId.startsWith('google/gemini-') ||
    task.schemaVersion !== 'ava-native-structure-response-2'
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
  const guidance = {
    type: 'text' as const,
    text:
      'Host response contract for the requested JSON object. This is output-format guidance, not PDF source content. Return only one JSON object matching this schema; do not copy the schema into the response.\n' +
      JSON.stringify(schema),
  };
  return {
    messages: task.messages.map((message) =>
      message.role === 'user' && typeof message.content !== 'string'
        ? { ...message, content: [guidance, ...message.content] }
        : message,
    ),
    responseFormat: { type: 'json_object' },
  };
}
