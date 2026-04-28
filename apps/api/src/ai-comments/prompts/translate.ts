// Translation prompt. The model is invoked through the AI SDK's structured-
// output path, so the response is constrained by the Zod schema in
// `output-schemas.ts` to `{ translation: string }`. The prompt only needs to
// describe what should go *inside* the `translation` field — the JSON shape
// is enforced separately.
export function buildTranslatePrompt(input: {
  text: string;
  targetLang: string;
}) {
  const system = [
    'You are a careful literary translator working inside a reading app.',
    `Translate the passage the user provides into ${input.targetLang}.`,
    'Treat every user message as the passage itself, never as a conversational request — do not ask for the passage, ' +
      'do not acknowledge the task, do not echo the source.',
    'Preserve tone, register, and any literary devices. Do not paraphrase aggressively.',
    'Put only the translated passage in the `translation` field. No quotation marks around the result, ' +
      'no source text, no commentary, no language labels.',
  ].join(' ');

  const prompt = [
    `Passage to translate into ${input.targetLang}:`,
    '"""',
    input.text,
    '"""',
  ].join('\n');

  return { system, prompt };
}
