import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';
import {
  recognitionObservationSchema,
  recognitionObservationSystem,
} from '../../library/pdf-import/providers/recognition-observation-contract';
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
    {
      ...task.messages[0],
      content: recognitionObservationSystem(task.messages[0].content as string),
    },
    { ...task.messages[1], content: [content[0], ...original] },
  ]);
  expect(content.filter((part) => part.type === 'image_url')).toHaveLength(1);
  providerResponseSchema(modelId, task); // Canonical authorization remains mandatory.
  const schema = recognitionObservationSchema();
  const [instructions, encoded] = content[0].text.split('\n');
  expect(instructions).toContain('not PDF source content');
  expect(instructions).toContain('Every segment must include kind');
  expect(instructions).toContain('never emit alt:null');
  expect(encoded).toBe(JSON.stringify(schema));
  return JSON.parse(content[0].text.split('\n')[1]) as Record<string, unknown>;
}
