import {
  geometryParent,
  geometryTask,
  geometryAnswer,
  geometryOriginal,
  geometryOriginalJson,
} from './geometry-fixture';
import { geometryBinding, geometryTaskId } from './geometry-binding';
import { geometryProviderTask } from './geometry-provider-task';
import { geometryResponse } from './geometry-response';
import { recognitionSchemas } from './generated/schemas';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';

it('binds the authored Python task ID and advertises only requested contexts with original pixels', () => {
  expect(geometryTaskId(geometryTask)).toBe(geometryTask.task_id);
  const task = geometryProviderTask(
    geometryTask,
    geometryParent,
    geometryOriginal,
    geometryOriginalJson,
  );
  expect(task.purpose).toBe('resolve_structure');
  expect(task.maxOutputTokens).toBe(3072);
  expect(task.responseSchema).toBe(
    recognitionSchemas.RecognitionGeometryResponse,
  );
  const body = JSON.stringify(task.messages);
  expect(body).not.toContain('original_response_json');
  expect(body).not.toContain('original_box_json');
  expect(body).not.toContain('native_evidence');
  expect(body).toContain(geometryParent.image.base64);
  expect(body).toContain(geometryTask.slots[0].segment_id);
  expect(
    providerResponseSchema('google/gemini-3.8-flash', task),
  ).toHaveProperty('properties');
  expect(() =>
    providerResponseSchema('google/gemini-3.8-flash', {
      ...task,
      responseSchema: recognitionSchemas.RecognitionResponse,
    }),
  ).toThrow('PDF_PROVIDER_REQUEST_UNAUTHORIZED');
});
it.each(['raw', 'render', 'context', 'slot', 'image'])(
  'refuses changed %s authority before correction dispatch',
  (kind) => {
    const task = structuredClone(geometryTask);
    if (kind === 'raw') task.original_response_json += ' ';
    else if (kind === 'render') task.render_sha256 = 'e'.repeat(64);
    else if (kind === 'context') task.slots[0].context += 'x';
    else if (kind === 'slot') task.slots[0].segment_index = 1;
    else task.image.width++;
    task.task_id = geometryTaskId(task);
    expect(() =>
      geometryBinding(
        task,
        geometryParent,
        geometryOriginal,
        geometryOriginalJson,
      ),
    ).toThrow();
  },
);
it('changes only the requested box and keeps the raw original response unchanged', () => {
  const before = structuredClone(geometryOriginal);
  const result = geometryResponse(
    geometryTask,
    JSON.stringify(geometryAnswer),
    geometryParent,
    geometryOriginal,
  );
  expect(result.corrected?.segments[0].box).toEqual(
    geometryAnswer.patches[0].box,
  );
  const changed = structuredClone(result.corrected!);
  changed.segments[0].box = before.segments[0].box;
  expect(changed).toEqual(before);
  expect(geometryOriginal).toEqual(before);
  expect(geometryTask.original_response_json).toBe(geometryOriginalJson);
});
it.each(['extra', 'id', 'reversed', 'outside', 'missing', 'binding'])(
  'refuses %s output rather than coercing it',
  (kind) => {
    const response = structuredClone(geometryAnswer);
    if (kind === 'extra')
      Object.assign(response.patches[0], { text: 'changed' });
    else if (kind === 'id') response.patches[0].segment_id = 'foreign';
    else if (kind === 'reversed')
      response.patches[0].box.y1 = response.patches[0].box.y0;
    else if (kind === 'outside') response.patches[0].box.x1 = 1001;
    else if (kind === 'missing') response.patches = [];
    else response.original_response_sha256 = 'e'.repeat(64);
    expect(() =>
      geometryResponse(
        geometryTask,
        JSON.stringify(response),
        geometryParent,
        geometryOriginal,
      ),
    ).toThrow();
  },
);
