import { anchorParent } from './anchor-context-fixture';
import { response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
// Reuse an authored, independently valid task/image identity for worker controls.
export const authoredTask = structuredClone(anchorParent);
export const authoredResponse = {
  ...response,
  task_id: authoredTask.task_id,
  source_sha256: authoredTask.source_sha256,
  render_sha256: authoredTask.image.sha256,
  segments: [
    {
      ...wireSegment,
      text: 'First line\nSecond line.',
      spans: [
        {
          anchor: {
            exact_text: 'First line',
            before: '',
            after: '\nSecond line.',
          },
          style: { id: 'emphasis', italic: true },
          note_label: null,
          target_text: null,
          url: null,
        },
      ],
    },
  ],
};
