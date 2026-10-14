import { createHash } from 'node:crypto';
import { task, response } from './test-fixture';
import { wireSegment } from './wire-segment-fixture';
const evidence = JSON.stringify({ reliable: false, lines: [] });
export const authoredTask = {
  ...task,
  prompt_version: 'ava-prose-region-15' as const,
  native_evidence: evidence,
  native_evidence_sha256: createHash('sha256').update(evidence).digest('hex'),
};
export const authoredResponse = {
  ...response,
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
