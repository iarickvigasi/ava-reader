import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import type { ProviderTask } from '../../library/pdf-import/providers/types';

/** Read the exact host guide while protecting the unchanged source and image parts. */
export function recognitionRequestGrammar(
  modelId: string,
  task: ProviderTask,
  request: Buffer,
): Record<string, unknown> {
  const body = JSON.parse(request.toString()) as {
    messages: ProviderTask['messages'];
    response_format: object;
  };
  const original = task.messages[1].content;
  const content = body.messages[1].content;
  if (
    typeof original === 'string' ||
    typeof content === 'string' ||
    content[0].type !== 'text'
  )
    throw new Error('Missing recognition host guide');
  expect(body.response_format).toEqual({ type: 'json_object' });
  expect(body.messages).toEqual([
    task.messages[0],
    { ...task.messages[1], content: [content[0], ...original] },
  ]);
  expect(content.filter((part) => part.type === 'image_url')).toHaveLength(1);
  const schema = providerResponseSchema(modelId, task);
  expect(content[0].text).toBe(
    'Host response contract for the requested JSON object. This is output-format guidance, not PDF source content. Return only one JSON object matching this schema; do not copy the schema into the response.\n' +
      JSON.stringify(schema),
  );
  return JSON.parse(content[0].text.split('\n')[1]) as Record<string, unknown>;
}
