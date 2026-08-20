import {
  buildContextSections,
  type PromptContextInput,
} from './context-sections';

// Etymology prompt — short, prose-only origin sketch for the selected word.
// Output is constrained to `{ etymology: string }` by the schema in
// `output-schemas.ts`, so this prompt only describes the field contents.
// Optional selection context helps pick the right word sense before tracing
// its origin.
export function buildEtymologyPrompt(
  input: PromptContextInput & { text: string },
) {
  const system = [
    'You write concise etymological notes for a reading app.',
    'Given a word or short phrase, briefly trace its origin: ' +
      'language of origin, root form, and how it entered the source language of the passage.',
    'Treat the user message as the word or phrase itself, ' +
      'never as a conversational request — do not acknowledge the task or echo the input.',
    'Keep the response to no more than three sentences.',
    'If multiple words are provided, focus on the single most lexically interesting headword and ignore filler words.',
    'Put plain prose in the `etymology` field. No headings, no bullet points, no lists, no markdown formatting.',
  ].join(' ');

  const sections = [
    ...buildContextSections(
      input,
      'use them only to pick the right sense of the word',
    ),
    `Word or phrase:\n"""\n${input.text}\n"""`,
  ];

  return { system, prompt: sections.join('\n\n') };
}
