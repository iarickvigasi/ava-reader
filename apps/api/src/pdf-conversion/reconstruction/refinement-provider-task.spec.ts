import { refinementProviderTask } from './refinement-provider-task';
import { refinementTask } from './refinement-fixture';
import {
  BIBLIOGRAPHIC_PROMPT,
  LEGACY_REFINEMENT_PROMPT,
  MIXED_HIERARCHY_PROMPT,
  REFINEMENT_PROMPT,
} from './generated/refinement-prompt';

it.each([
  ['ava-book-refinement-3', LEGACY_REFINEMENT_PROMPT],
  ['ava-book-refinement-4', BIBLIOGRAPHIC_PROMPT],
  ['ava-book-refinement-5', REFINEMENT_PROMPT],
  ['ava-book-refinement-6', MIXED_HIERARCHY_PROMPT],
] as const)('dispatches the immutable prompt for %s', (version, prompt) => {
  const result = refinementProviderTask(
    { ...refinementTask, prompt_version: version },
    refinementTask.source_sha256,
  );
  expect(result.promptVersion).toBe(version);
  expect(result.messages[0]).toEqual({ role: 'system', content: prompt });
});

it('sends native heading ancestry authority to the source comparison without losing its measured style', () => {
  const result = refinementProviderTask(
    {
      ...refinementTask,
      prompt_version: 'ava-book-refinement-6',
      nodes: [
        {
          ...refinementTask.nodes[0],
          structure_candidate: true,
          candidate_original_kind: 'heading',
          observed_style: {
            id: 'native-measured',
            relative_size: 1.27,
            bold: true,
          },
        },
      ],
    },
    refinementTask.source_sha256,
  );
  const message = result.messages[1];
  expect(message.role).toBe('user');
  if (typeof message.content === 'string' || message.content[0].type !== 'text')
    throw new Error('Expected the source comparison catalogue');
  expect(message.content[0].text).toContain(
    '"candidate_original_kind":"heading"',
  );
  expect(message.content[0].text).toContain('"id":"native-measured"');
  expect(result.messages[0]).toEqual({
    role: 'system',
    content: MIXED_HIERARCHY_PROMPT,
  });
});
