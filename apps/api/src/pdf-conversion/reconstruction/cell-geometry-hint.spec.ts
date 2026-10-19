import { authoredCopy, containmentFixture } from './cell-containment-fixture';
import {
  geometryOriginal,
  geometryOriginalJson,
  geometryParent,
  geometryTask,
} from './cell-geometry-fixture';
import { cellGeometryProviderTask } from './cell-geometry-provider-task';
import { cellGeometryTaskId } from './cell-geometry-binding';
import { geometrySha } from './geometry-binding';
import type { RecognitionBox } from './generated/RecognitionCellGeometryTask';

type HintContext = {
  slots: { context: string; original_box_untrusted_hint: RecognitionBox }[];
};

it('keeps repeated-label cell hints distinct and preserves invalid endpoints as untrusted evidence', () => {
  const before = authoredCopy(geometryOriginal);
  const provider = cellGeometryProviderTask(
    geometryTask,
    geometryParent,
    geometryOriginal,
    geometryOriginalJson,
  );
  const content = provider.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw new Error('AUTHORED_CELL_CONTEXT_REQUIRED');
  const body = JSON.parse(content[0].text) as HintContext;
  expect(body.slots.map((s) => s.original_box_untrusted_hint)).toEqual([
    {
      coordinate_space: 'render_normalized_1000',
      x0: 10,
      x1: 100,
      y0: 100,
      y1: 10,
    },
    {
      coordinate_space: 'render_normalized_1000',
      x0: 110,
      x1: 200,
      y0: 100,
      y1: 10,
    },
  ]);
  expect(body.slots.map((s) => s.context)).toEqual(['Same', 'Same']);
  expect(geometryOriginal).toEqual(before);
});

it('passes an outside-table hint without clamping or disclosing the original response', () => {
  const { task, original, raw } = containmentFixture('y1');
  const provider = cellGeometryProviderTask(
    task,
    geometryParent,
    original,
    raw,
  );
  const serialized = JSON.stringify(provider.messages);
  expect(serialized).toContain('original_box_untrusted_hint');
  const content = provider.messages[1].content;
  if (typeof content === 'string' || content[0].type !== 'text')
    throw new Error('AUTHORED_CELL_CONTEXT_REQUIRED');
  const hint = (JSON.parse(content[0].text) as HintContext).slots[0]
    .original_box_untrusted_hint;
  expect(hint.y1).toBe(801);
  expect(task.slots[0].table_box.y1).toBe(800);
  expect(serialized).not.toContain('original_response_json');
  expect(serialized).not.toContain('native_evidence');
});

it('refuses a substituted hint even when the attacker rehashes its slot and task identities', () => {
  const { task, original, raw } = containmentFixture('y1');
  task.slots[0].original_box_json = JSON.stringify({
    coordinate_space: 'render_normalized_1000',
    x0: 0,
    y0: 0,
    x1: 1000,
    y1: 1000,
  });
  task.slots[0].original_box_sha256 = geometrySha(
    task.slots[0].original_box_json,
  );
  const s = task.slots[0];
  s.slot_id =
    'cell-geometry-' +
    geometrySha(
      JSON.stringify([
        s.segment_index,
        s.segment_id,
        s.row_index,
        s.cell_index,
        s.cell_text_sha256,
        s.original_box_sha256,
      ]),
    );
  task.task_id = cellGeometryTaskId(task);
  expect(() =>
    cellGeometryProviderTask(task, geometryParent, original, raw),
  ).toThrow();
});
