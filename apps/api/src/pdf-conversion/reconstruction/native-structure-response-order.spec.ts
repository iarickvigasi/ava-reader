import { nativeStructureResponse } from './native-structure-response';
import { nativeTask, nativeResponse } from './native-structure-fixture';
import { validatePacket } from './validate-packet';
import type { NativeStructureTask } from './generated/NativeStructureTask';
import type { NativeStructureResponse } from './generated/NativeStructureResponse';

function fixture() {
  const task = structuredClone(nativeTask);
  task.regions[0].line_ids.push('p1-line2', 'p1-line3');
  for (const id of ['p1-line2', 'p1-line3'])
    task.lines.push({ ...structuredClone(task.lines[1]), id, spans: [] });
  task.regions[1].source.role = 'furniture';
  const response = structuredClone(nativeResponse);
  response.groups = [
    response.groups[0],
    {
      ...response.groups[0],
      id: 'body-two',
      line_ids: ['p1-line2', 'p1-line3'],
    },
    {
      ...response.groups[0],
      id: 'furniture-one',
      region_id: 'notes',
      kind: 'furniture',
      line_ids: ['p1-note'],
    },
  ];
  validatePacket('NativeStructureTask', task);
  validatePacket('NativeStructureResponse', response);
  return { task, response };
}

it.each([
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
])(
  'validates complete source intervals while retaining provider collection order: %j',
  (...order) => {
    const { task, response } = fixture();
    const shuffled = {
      ...response,
      groups: order.map((index) => response.groups[index]),
    };
    const output = JSON.stringify(shuffled);
    expect(nativeStructureResponse(task, output)).toEqual(shuffled);
    expect(JSON.parse(output)).toEqual(shuffled);
    expect(shuffled.groups.map((group) => group.id)).toEqual(
      order.map((index) => response.groups[index].id),
    );
  },
);

it.each([
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].line_ids.reverse();
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].line_ids = ['p1-line0', 'p1-line2'];
    r.groups[1].line_ids = ['p1-line1', 'p1-line3'];
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[1].line_ids = [...r.groups[0].line_ids];
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[1].line_ids.pop();
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].line_ids[0] = 'foreign-line';
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].line_ids = ['p1-line0', 'p1-note'];
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].region_id = 'notes';
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[0].id = r.groups[1].id;
  },
  (_t: NativeStructureTask, r: NativeStructureResponse) => {
    r.groups[2].kind = 'paragraph';
  },
  (t: NativeStructureTask) => {
    t.regions[1].artifact_id = 'preserved-artifact';
  },
  (t: NativeStructureTask, r: NativeStructureResponse) => {
    t.artifacts.push({
      id: r.groups[0].id,
      kind: 'figure',
      segment_sha256: 'a'.repeat(64),
    });
  },
])(
  'refuses unsafe ownership even when the group collection is shuffled',
  (mutate) => {
    const { task, response } = fixture();
    mutate(task, response);
    response.groups.reverse();
    expect(() =>
      nativeStructureResponse(task, JSON.stringify(response)),
    ).toThrow('SOURCE_MISMATCH');
  },
);
