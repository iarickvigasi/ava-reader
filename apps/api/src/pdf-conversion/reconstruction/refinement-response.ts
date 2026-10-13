import { bindFrontmatterTitleResponse } from './frontmatter-title-response';
import type { RefinementTask } from './refinement-packets';
import { refinementResponseName } from './refinement-packets';
import { parsePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';
// New title authority is exact source classification; historical response semantics stay unchanged.
export function refinementResponse(task: RefinementTask, output: string) {
  if (task.schema_version === 'ava-printed-title-task-2')
    return bindFrontmatterTitleResponse(
      task,
      parsePacket(
        'FrontmatterTitleResponse',
        Buffer.from(output),
        2 * 1024 ** 2,
      ),
    );
  const response = parsePacket(
    refinementResponseName(task),
    Buffer.from(output),
    2 * 1024 ** 2,
  );
  if (task.schema_version === 'ava-printed-title-task-1') {
    if (
      response.schema_version !== 'ava-printed-title-response-1' ||
      response.task_id !== task.task_id ||
      response.source_sha256 !== task.source_sha256 ||
      response.observation_sha256 !== task.observation_sha256 ||
      response.image_sha256 !== task.image.sha256 ||
      response.decision.node_id !== task.node.id ||
      response.decision.text_sha256 !== task.node.text_sha256 ||
      new Set(response.decision.evidence_ids).size !== 2 ||
      [...response.decision.evidence_ids].sort().join('|') !==
        task.crops
          .map((c) => c.id)
          .sort()
          .join('|')
    )
      throw new PdfRuntimeError('SOURCE_MISMATCH');
  }
  return response;
}
