import type { FrontmatterTitleTask } from './generated/FrontmatterTitleTask';
import type { FrontmatterTitleResponse } from './generated/FrontmatterTitleResponse';
import { frontmatterTitleEvidence } from './frontmatter-title-binding';
import { PdfRuntimeError } from '../runtime/runtime-error';

const exactIds = (actual: string[], expected: string[]) =>
  new Set(actual).size === actual.length &&
  actual.length === expected.length &&
  [...actual].sort().join('|') === [...expected].sort().join('|');

export function bindFrontmatterTitleResponse(
  task: FrontmatterTitleTask,
  response: FrontmatterTitleResponse,
) {
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.observation_sha256 !== task.observation_sha256 ||
    response.image_sha256 !== task.image.sha256
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (response.selected_node_id === null) {
    if (
      response.selected_text_sha256 !== null ||
      response.evidence_ids.length ||
      response.cover !== null
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
    return response;
  }
  const node = task.nodes.find(
    (value) => value.id === response.selected_node_id,
  );
  if (
    !node ||
    !node.primary_eligible ||
    response.selected_text_sha256 !== node.text_sha256 ||
    !exactIds(response.evidence_ids, frontmatterTitleEvidence(task, node.id))
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  if (response.cover !== null) {
    const ids = response.cover.node_ids;
    const ordered = task.nodes
      .filter((value) => value.page === 1 && ids.includes(value.id))
      .map((value) => value.id);
    const titleCrops = ids.map((id) => frontmatterTitleEvidence(task, id)[0]);
    const context = task.crops.find(
      (crop) => crop.part === 'context' && crop.page === 1,
    );
    if (
      !context ||
      new Set(ids).size !== ids.length ||
      ordered.join('|') !== ids.join('|') ||
      !exactIds(response.cover.evidence_ids, [...titleCrops, context.id])
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  return response;
}
