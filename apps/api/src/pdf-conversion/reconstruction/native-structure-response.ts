import type { NativeStructureTask } from './generated/NativeStructureTask';
import { parsePacket } from './validate-packet';
import { PdfRuntimeError } from '../runtime/runtime-error';

export function nativeStructureResponse(
  task: NativeStructureTask,
  output: string,
) {
  const response = parsePacket(
    'NativeStructureResponse',
    Buffer.from(output),
    8 * 1024 ** 2,
  );
  const expected = task.regions.flatMap((region) =>
    region.artifact_id == null
      ? region.line_ids.map((id) => [region.source.id, id])
      : [],
  );
  const observed = response.groups.flatMap((group) =>
    group.line_ids.map((id) => [group.region_id, id]),
  );
  const artifacts = new Set(task.artifacts.map((artifact) => artifact.id));
  const regions = new Map(
    task.regions.map((region) => [region.source.id, region]),
  );
  const boundaries = new Map(
    task.boundaries.map((boundary) => [boundary.candidate_id, boundary]),
  );
  const eligible = new Set(
    task.eligible_callouts.map((callout) => callout.span_id),
  );
  if (
    response.task_id !== task.task_id ||
    response.source_sha256 !== task.source_sha256 ||
    response.observation_sha256 !== task.observation_sha256 ||
    response.render_sha256 !== task.image.sha256 ||
    JSON.stringify(expected) !== JSON.stringify(observed) ||
    new Set(response.groups.map((group) => group.id)).size !==
      response.groups.length ||
    response.groups.some(
      (group) =>
        artifacts.has(group.id) ||
        (group.kind === 'furniture') !==
          (regions.get(group.region_id)?.source.role === 'furniture'),
    ) ||
    response.boundary_dispositions.length !== boundaries.size ||
    new Set(
      response.boundary_dispositions.map((decision) => decision.candidate_id),
    ).size !== boundaries.size ||
    response.boundary_dispositions.some(
      (decision) =>
        boundaries.get(decision.candidate_id)?.candidate_sha256 !==
        decision.candidate_sha256,
    ) ||
    new Set(response.references.map((reference) => reference.span_id)).size !==
      response.references.length ||
    response.references.some((reference) => !eligible.has(reference.span_id))
  )
    throw new PdfRuntimeError('SOURCE_MISMATCH');
  // Essential uncertainty, role relationships and boundary semantics are checked
  // against immutable source by the waiting worker before it can request another task.
  return response;
}
