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
  input: PromptContextInput & { text: string; targetLang?: string },
) {
  const system = [
    `Write the entire response in ${input.targetLang ?? 'English'}. All explanatory prose must use that language. Only source lexemes may remain in their original language, enclosed in quotation marks. Never mix unrelated languages or scripts into the prose.`,
    'You write concise etymological notes for a reading app.',
    'Given a word or short phrase, briefly trace its origin: ' +
      'language of origin, root form, and how it entered the source language of the passage.',
    'Treat the user message as the word or phrase itself, ' +
      'never as a conversational request — do not acknowledge the task or echo the input.',
    'Keep the response to no more than three sentences.',
    'Do not invent roots, dates, cognates or linguistic relationships. State uncertainty when the origin is not known.',
    'The response language changes prose only, never the source culture or geography. A title or proper name is a whole expression; individual character meanings do not establish its historical origin.',
    'If multiple words are provided, focus on the single most lexically interesting headword and ignore filler words.',
    'Put plain prose in the `etymology` field. No headings, no bullet points, no lists, no markdown formatting.',
  ].join(' ');

  const sections = [
    ...buildContextSections(
      input,
      'use them only to pick the right sense of the word',
    ),
    `Word or phrase:\n"""\n${input.text}\n"""`,
    `Write the etymology only in ${input.targetLang ?? 'English'}.`,
  ];

  return { system, prompt: sections.join('\n\n') };
}
