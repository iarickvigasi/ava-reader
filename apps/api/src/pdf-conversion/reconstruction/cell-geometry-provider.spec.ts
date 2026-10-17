import {
  geometryParent,
  geometryTask,
  geometryAnswer,
  geometryOriginal,
  geometryOriginalJson,
} from './cell-geometry-fixture';
import {
  cellGeometryBinding,
  cellGeometryTaskId,
} from './cell-geometry-binding';
import { cellGeometryProviderTask } from './cell-geometry-provider-task';
import { cellGeometryResponse } from './cell-geometry-response';
import { recognitionSchemas } from './generated/schemas';
import { providerResponseSchema } from '../../library/pdf-import/providers/response-schema';

it('binds the authored Python task ID and advertises only requested contexts with original pixels', () => {
  expect(cellGeometryTaskId(geometryTask)).toBe(geometryTask.task_id);
  const task = cellGeometryProviderTask(
    geometryTask,
    geometryParent,
    geometryOriginal,
    geometryOriginalJson,
  );
  expect(task.purpose).toBe('resolve_structure');
  expect(task.maxOutputTokens).toBe(4096);
  expect(task.responseSchema).toBe(
    recognitionSchemas.RecognitionCellGeometryResponse,
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
  expect(
    providerResponseSchema('google/gemini-3.8-flash', task).description,
  ).toContain('table-cell geometry');
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
    task.task_id = cellGeometryTaskId(task);
    expect(() =>
      cellGeometryBinding(
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
  const result = cellGeometryResponse(
    geometryTask,
    JSON.stringify(geometryAnswer),
    geometryParent,
    geometryOriginal,
  );
  expect(result.corrected).toHaveProperty(
    ['segments', 0, 'cells', 0, 0, 'box'],
    geometryAnswer.patches[0].box,
  );
  const changed = structuredClone(result.corrected!);
  for (const slot of geometryTask.slots)
    changed.segments[slot.segment_index].cells![slot.row_index][
      slot.cell_index
    ].box =
      before.segments[slot.segment_index].cells![slot.row_index][
        slot.cell_index
      ].box;
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
    else if (kind === 'id')
      response.patches[0].slot_id = 'cell-geometry-' + 'e'.repeat(64);
    else if (kind === 'reversed')
      response.patches[0].box.y1 = response.patches[0].box.y0;
    else if (kind === 'outside') response.patches[0].box.x1 = 1001;
    else if (kind === 'missing') response.patches = [];
    else response.original_response_sha256 = 'e'.repeat(64);
    expect(() =>
      cellGeometryResponse(
        geometryTask,
        JSON.stringify(response),
        geometryParent,
        geometryOriginal,
      ),
    ).toThrow();
  },
);

it('rejects duplicate wire keys and malformed Unicode before interpreting a cell patch', () => {
  const raw = JSON.stringify(geometryAnswer);
  for (const text of [
    raw.replace('"slot_id":', '"slot_id":"discarded","slot_id":'),
    raw.replace('"patches":', '"patches":[],"patches":'),
    raw.replace('"outcome":', '"discarded":"\ud800","outcome":'),
  ]) {
    expect(() =>
      cellGeometryResponse(
        geometryTask,
        text,
        geometryParent,
        geometryOriginal,
      ),
    ).toThrow();
  }
});
