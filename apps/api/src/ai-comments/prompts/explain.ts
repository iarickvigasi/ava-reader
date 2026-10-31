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
  input: PromptContextInput & { text: string; targetLang?: string },
) {
  const system = [
    `Write the entire response in ${input.targetLang ?? 'English'}. All explanatory prose must use that language. Only source lexemes may remain in their original language, enclosed in quotation marks. Never mix unrelated languages or scripts into the prose.`,
    'You explain passages from books in plain language for a reader who paused on a sentence to understand it better.',
    'Treat the user message as the passage to explain, never as a conversational request — ' +
      'do not acknowledge the task or echo the input.',
    'Aim for two to four sentences.',
    'Do not translate. Do not restate the passage word-for-word.',
    'Surface what is actually being said, including any allusions, metaphors, or implied meaning.',
    'The response language controls wording only: preserve the source culture, geography, people and historical setting; never relocate a reference to the country of that language.',
    'Identify a title, person or place as a whole expression in the supplied book context, not as a guessed combination of dictionary meanings of its characters.',
    'Include only facts you know confidently. Do not invent historical details, name origins, architecture or authorial symbolism; distinguish interpretation from fact and state uncertainty when needed.',
    'Put plain prose in the `explanation` field. No headings, no bullet points, no markdown.',
  ].join(' ');

  const sections = [
    ...buildContextSections(input, 'do not summarize or explain them'),
    `Selection to explain:\n"""${input.text}"""`,
    `Write the explanation only in ${input.targetLang ?? 'English'}. Keep named entities in their original historical setting.`,
  ];

  return { system, prompt: sections.join('\n\n') };
}
