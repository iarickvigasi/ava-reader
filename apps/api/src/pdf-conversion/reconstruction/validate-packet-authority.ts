import type { PrintedTitleRefinementBatch } from './generated/PrintedTitleRefinementBatch';
import type { PrintedTitleReconstructionInput } from './generated/PrintedTitleReconstructionInput';
import type { NativeLayoutReconstructionInput } from './generated/NativeLayoutReconstructionInput';
import type { NativeStructureReconstructionInput } from './generated/NativeStructureReconstructionInput';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function validatePacketAuthority(name: string, value: unknown) {
  if (name === 'PrintedTitleRefinementBatch') {
    const packet = value as PrintedTitleRefinementBatch;
    if (
      packet.tasks.filter(
        (task) => task.schema_version === 'ava-printed-title-task-1',
      ).length !== 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'NativeStructureReconstructionInput') {
    const packet = value as NativeStructureReconstructionInput;
    if (
      packet.responses.length + packet.native_structure_responses.length >
        25000 ||
      (packet.refinements ?? []).filter(
        (r) => r.schema_version === 'ava-printed-title-response-1',
      ).length > 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'NativeLayoutReconstructionInput') {
    const packet = value as NativeLayoutReconstructionInput;
    if (
      (packet.refinements ?? []).filter(
        (r) => r.schema_version === 'ava-printed-title-response-1',
      ).length > 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'PrintedTitleReconstructionInput') {
    const packet = value as PrintedTitleReconstructionInput;
    if (
      (packet.refinements ?? []).filter(
        (response) =>
          response.schema_version === 'ava-printed-title-response-1',
      ).length !== 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
}
