// Authored locator controls, independent of visual transcription quality.
import {
  anchorOriginal,
  anchorParent,
  anchorTask,
  anchorResponse,
} from './anchor-context-fixture';
import {
  anchorContextBinding,
  contextSha,
  contextTaskId,
} from './anchor-context-binding';

export function boundedContextFixture(
  before = 'L'.repeat(129),
  after = 'R'.repeat(129),
  tail = '|x',
) {
  const original = structuredClone(anchorOriginal);
  original.segments = original.segments.slice(0, 1);
  const segment = original.segments[0];
  segment.text = before + 'x' + after + tail;
  segment.spans[0].anchor = { exact_text: 'x' };
  const task = structuredClone(anchorTask);
  task.slots = [task.slots[0]];
  task.slots[0].segment_text_sha256 = contextSha(segment.text);
  task.slots[0].original_span_json = JSON.stringify(segment.spans[0]);
  task.slots[0].span_sha256 = contextSha(task.slots[0].original_span_json);
  task.original_response_json = JSON.stringify(original);
  task.original_response_sha256 = contextSha(task.original_response_json);
  task.task_id = contextTaskId(task);
  anchorContextBinding(task, anchorParent, original);
  const response = structuredClone(anchorResponse);
  response.task_id = task.task_id;
  response.original_response_sha256 = task.original_response_sha256;
  response.patches = [
    {
      segment_index: 0,
      span_index: 0,
      span_sha256: task.slots[0].span_sha256,
      before,
      after,
    },
  ];
  return { parent: anchorParent, original, task, response };
}
