import type { NativeStructureTask2 } from './generated/NativeStructureTask2';
import { parsePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
import { bindNativeStructureResponse } from './native-structure-response-binding';

export function nativeStructure2Response(
  task: NativeStructureTask2,
  output: string,
) {
  if (
    task.schema_version !== 'ava-native-structure-task-2' ||
    task.response_schema_version !== 'ava-native-structure-response-2'
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  const response = parsePacket(
    'NativeStructureResponse2',
    Buffer.from(output),
    8 * 1024 ** 2,
  );
  bindNativeStructureResponse(task, response);
  // Source semantics and canonical assembly stay worker-owned; preserve the typed receipt exactly.
  return response;
}
