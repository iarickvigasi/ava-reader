import type { RecognitionSegment1 } from './generated/RecognitionResponse';
import { authoredCopy, containmentFixture } from './cell-containment-fixture';
import { geometryParent } from './cell-geometry-fixture';
import {
  cellGeometryBinding,
  cellGeometryTaskId,
} from './cell-geometry-binding';
import { cellGeometryResponse } from './cell-geometry-response';

it.each(['x0', 'y0', 'x1', 'y1'] as const)(
  'binds a positive in-image cell outside the table at %s and changes only that box',
  (edge) => {
    const { task, raw, original, response, goodBox } = containmentFixture(edge);
    const before = authoredCopy(original);
    expect(cellGeometryBinding(task, geometryParent, original, raw)).toEqual(
      task,
    );
    const result = cellGeometryResponse(
      task,
      JSON.stringify(response),
      geometryParent,
      original,
    );
    const expected = authoredCopy(before);
    const table: RecognitionSegment1 = expected.segments[0];
    if (table.kind !== 'table') throw new Error('AUTHORED_TABLE_REQUIRED');
    table.cells![0][0].box = goodBox;
    expect(result.corrected).toEqual(expected);
    expect(original).toEqual(before);
    expect(task.original_response_json).toBe(raw);
  },
);
it('requires the exact union and order of outside and reversed cells', () => {
  const { task, raw, original } = containmentFixture('y1', true);
  expect(cellGeometryBinding(task, geometryParent, original, raw)).toEqual(
    task,
  );
  for (const mode of ['omit', 'reorder']) {
    const changed = authoredCopy(task);
    if (mode === 'omit') changed.slots.shift();
    else changed.slots.reverse();
    changed.task_id = cellGeometryTaskId(changed);
    expect(() =>
      cellGeometryBinding(changed, geometryParent, original, raw),
    ).toThrow();
  }
});
it('refuses corrected boxes outside the frozen table even inside the source image', () => {
  const { task, original, response } = containmentFixture();
  response.patches[0].box.y1 = 801;
  expect(() =>
    cellGeometryResponse(
      task,
      JSON.stringify(response),
      geometryParent,
      original,
    ),
  ).toThrow();
});
