import * as prompts from './generated/prompt';
import type { RecognitionTask } from './generated/RecognitionTask';
const instructions: Record<RecognitionTask['prompt_version'], string> = {
  'ava-prose-region-2': prompts.RECOGNITION_PROMPT,
  'ava-prose-region-3': prompts.MERGED_TABLE_PROMPT,
  'ava-prose-region-4': prompts.PINNED_TABLE_PROMPT,
  'ava-prose-region-5': prompts.EXPLICIT_STYLE_PROMPT,
  'ava-prose-region-6': prompts.PINNED_STYLE_PROMPT,
  'ava-prose-region-7': prompts.ANCHORED_STYLE_PROMPT,
  'ava-prose-region-8': prompts.PINNED_ANCHORED_PROMPT,
  'ava-prose-region-9': prompts.BOUNDARY_STYLE_PROMPT,
  'ava-prose-region-10': prompts.PINNED_BOUNDARY_PROMPT,
  'ava-prose-region-11': prompts.UNICODE_STYLE_PROMPT,
  'ava-prose-region-12': prompts.PINNED_UNICODE_PROMPT,
  'ava-prose-region-13': prompts.ORDERED_LIST_PROMPT,
  'ava-prose-region-14': prompts.PINNED_ORDERED_LIST_PROMPT,
};
export function recognitionSystemPrompt(
  version: RecognitionTask['prompt_version'],
) {
  return instructions[version];
}
