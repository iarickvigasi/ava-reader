import type { NativeStructureTask } from './generated/NativeStructureTask';
import { parsePacket } from './validate-packet';
import { bindNativeStructureResponse } from './native-structure-response-binding';

export function nativeStructureResponse(
  task: NativeStructureTask,
  output: string,
) {
  const response = parsePacket(
    'NativeStructureResponse',
    Buffer.from(output),
    8 * 1024 ** 2,
  );
  bindNativeStructureResponse(task, response);
  // Essential uncertainty, role relationships and boundary semantics are checked
  // against immutable source by the waiting worker before it can request another task.
  // Retain provider order for response-digest authority; only the validated view uses source order.
  return response;
}
