import type { NativeStructureTask } from './generated/NativeStructureTask';

// Private measured styles, span offsets and artifact snapshots never enter model messages.
export function nativeStructurePublicView(task: NativeStructureTask) {
  return {
    schema_version: task.schema_version,
    task_id: task.task_id,
    purpose: task.purpose,
    source_sha256: task.source_sha256,
    observation_sha256: task.observation_sha256,
    profile_id: task.profile_id,
    page_number: task.page_number,
    page_width_pt: task.page_width_pt,
    page_height_pt: task.page_height_pt,
    render_sha256: task.image.sha256,
    image: {
      media_type: task.image.media_type,
      width: task.image.width,
      height: task.image.height,
    },
    lines: task.lines.map(({ id, text, box }) => ({ id, text, box })),
    regions: task.regions.map(({ source, line_ids, artifact_id }) => ({
      id: source.id,
      box: source.box,
      role: source.role,
      line_ids,
      artifact_id,
    })),
    artifacts: task.artifacts.map(({ id, kind }) => ({ id, kind })),
    boundaries: task.boundaries,
    eligible_callouts: task.eligible_callouts,
  };
}
