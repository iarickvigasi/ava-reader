import { refinementProviderTask } from './refinement-provider-task';
import { refinementTask } from './refinement-fixture';
import {
  BIBLIOGRAPHIC_PROMPT,
  LEGACY_REFINEMENT_PROMPT,
  REFINEMENT_PROMPT,
} from './generated/refinement-prompt';

it.each([
  ['ava-book-refinement-3', LEGACY_REFINEMENT_PROMPT],
  ['ava-book-refinement-4', BIBLIOGRAPHIC_PROMPT],
  ['ava-book-refinement-5', REFINEMENT_PROMPT],
] as const)('dispatches the immutable prompt for %s', (version, prompt) => {
  const result = refinementProviderTask(
    { ...refinementTask, prompt_version: version },
    refinementTask.source_sha256,
  );
  expect(result.promptVersion).toBe(version);
  expect(result.messages[0]).toEqual({ role: 'system', content: prompt });
});
