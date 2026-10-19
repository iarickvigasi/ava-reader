import type { RecognitionSegment1 } from './generated/RecognitionResponse';
import {
  geometryAnswer,
  geometryOriginal,
  geometryTask,
} from './cell-geometry-fixture';
import { cellGeometryTaskId } from './cell-geometry-binding';
import { geometrySha } from './geometry-binding';

export const authoredCopy = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

// Authored boxes; no book content or provider responses are included in this fixture.
export function containmentFixture(
  edge: 'x0' | 'y0' | 'x1' | 'y1' = 'y1',
  mixed = false,
) {
  const original = authoredCopy(geometryOriginal);
  const table: RecognitionSegment1 = original.segments[0];
  if (table.kind !== 'table') throw new Error('AUTHORED_TABLE_REQUIRED');
  table.box = { ...table.box, x0: 5, y0: 5, x1: 800, y1: 800 };
  table.cells![0].forEach((cell) =>
    Object.assign(cell.box!, { y0: 10, y1: 100 }),
  );
  const goodBox = authoredCopy(table.cells![0][0].box!);
  table.cells![0][0].box![edge] = edge === 'x0' || edge === 'y0' ? 4 : 801;
  if (mixed) Object.assign(table.cells![0][1].box!, { y0: 100, y1: 10 });
  const raw = JSON.stringify(original);
  const task = authoredCopy(geometryTask);
  task.original_response_json = raw;
  task.original_response_sha256 = geometrySha(raw);
  const slotFor = (column: number) => {
    const cell = table.cells![0][column];
    const slot = authoredCopy(geometryTask.slots[0]);
    Object.assign(slot, {
      segment_index: 0,
      segment_id: table.id,
      row_index: 0,
      cell_index: column,
      cell_text_sha256: geometrySha(cell.text),
      original_box_json: JSON.stringify(cell.box),
      original_box_sha256: geometrySha(JSON.stringify(cell.box)),
      table_box: authoredCopy(table.box),
      context: Array.from(cell.text).slice(0, 256).join(''),
      row_context: table.cells![0].map((value) =>
        Array.from(value.text).slice(0, 256).join(''),
      ),
    });
    slot.slot_id =
      'cell-geometry-' +
      geometrySha(
        JSON.stringify([
          0,
          table.id,
          0,
          column,
          slot.cell_text_sha256,
          slot.original_box_sha256,
        ]),
      );
    return slot;
  };
  task.slots = mixed ? [slotFor(0), slotFor(1)] : [slotFor(0)];
  task.task_id = cellGeometryTaskId(task);
  const response = {
    ...authoredCopy(geometryAnswer),
    task_id: task.task_id,
    original_response_sha256: task.original_response_sha256,
    patches: task.slots.map((slot) => ({
      slot_id: slot.slot_id,
      box:
        slot.cell_index === 0
          ? goodBox
          : {
              ...table.cells![0][slot.cell_index].box!,
              y0: 10,
              y1: 100,
            },
    })),
  };
  return { original, raw, task, response, goodBox };
}
