import type { ContinuationReconstructionInput } from './generated/ContinuationReconstructionInput';
import type { ContinuationRefinementBatch } from './generated/ContinuationRefinementBatch';
import type { CellGeometryReconstructionInput } from './generated/CellGeometryReconstructionInput';
import type { NativeStructure2ReconstructionInput } from './generated/NativeStructure2ReconstructionInput';
import type { FrontmatterTitleReconstructionInput } from './generated/FrontmatterTitleReconstructionInput';
import type { FrontmatterTitleRefinementBatch } from './generated/FrontmatterTitleRefinementBatch';
import type { NativeWordWrapReconstructionInput } from './generated/NativeWordWrapReconstructionInput';
import type { PrintedTitleRefinementBatch } from './generated/PrintedTitleRefinementBatch';
import type { PrintedTitleReconstructionInput } from './generated/PrintedTitleReconstructionInput';
import type { NativeLayoutReconstructionInput } from './generated/NativeLayoutReconstructionInput';
import type { NativeStructureReconstructionInput } from './generated/NativeStructureReconstructionInput';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function validatePacketAuthority(name: string, value: unknown) {
  if (
    name === 'FrontmatterTitleRefinementBatch' ||
    name === 'ContinuationRefinementBatch'
  ) {
    const packet = value as
      | FrontmatterTitleRefinementBatch
      | ContinuationRefinementBatch;
    if (
      packet.tasks.filter(
        (task) => task.schema_version === 'ava-printed-title-task-2',
      ).length > 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (
    name === 'FrontmatterTitleReconstructionInput' ||
    name === 'NativeStructure2ReconstructionInput' ||
    name === 'CellGeometryReconstructionInput' ||
    name === 'ContinuationReconstructionInput'
  ) {
    const packet = value as
      | FrontmatterTitleReconstructionInput
      | NativeStructure2ReconstructionInput
      | CellGeometryReconstructionInput
      | ContinuationReconstructionInput;
    const parents = packet.geometry_corrections.map(
      (proof) => proof.response.original_task_id,
    );
    if (
      packet.responses.length + packet.native_structure_responses.length >
        25000 ||
      (packet.refinements ?? []).filter(
        (response) =>
          response.schema_version === 'ava-printed-title-response-2',
      ).length > 1 ||
      new Set(parents).size !== parents.length ||
      packet.geometry_corrections.some(
        (proof) =>
          proof.response.outcome !== 'corrected' ||
          !packet.responses.some(
            (response) => response.task_id === proof.response.original_task_id,
          ),
      )
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (name === 'PrintedTitleRefinementBatch') {
    const packet = value as PrintedTitleRefinementBatch;
    if (
      packet.tasks.filter(
        (task) => task.schema_version === 'ava-printed-title-task-1',
      ).length !== 1
    )
      throw new PdfRuntimeError('INVALID_RESULT');
  }
  if (
    name === 'NativeStructureReconstructionInput' ||
    name === 'NativeWordWrapReconstructionInput'
  ) {
    const packet = value as
      | NativeStructureReconstructionInput
      | NativeWordWrapReconstructionInput;
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
