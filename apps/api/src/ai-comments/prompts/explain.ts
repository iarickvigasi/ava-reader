import {
  buildContextSections,
  type PromptContextInput,
} from './context-sections';

// Explain prompt — surfaces what's actually being said in a passage. The
// caller may pass surrounding context (the sentences around the selection)
// and book metadata so allusions can be resolved more accurately. Output is
// constrained to `{ explanation: string }` by the schema in
// `output-schemas.ts`, so this prompt only describes the field contents.
export function buildExplainPrompt(
  input: PromptContextInput & { text: string },
) {
  const system = [
    'You explain passages from books in plain language for a reader who paused on a sentence to understand it better.',
    'Treat the user message as the passage to explain, never as a conversational request — ' +
      'do not acknowledge the task or echo the input.',
    'Aim for two to four sentences.',
    'Do not translate. Do not restate the passage word-for-word.',
    'Surface what is actually being said, including any allusions, metaphors, or implied meaning.',
    'Put plain prose in the `explanation` field. No headings, no bullet points, no markdown.',
  ].join(' ');

  const sections = [
    ...buildContextSections(input, 'do not summarize or explain them'),
    `Selection to explain:\n"""${input.text}"""`,
  ];

  return { system, prompt: sections.join('\n\n') };
}
