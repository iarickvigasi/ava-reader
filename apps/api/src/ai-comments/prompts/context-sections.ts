export type PromptContextInput = {
  context?: string;
  bookTitle?: string;
  author?: string;
};

// Shared prompt sections for the selection context (spec 5.2): a "From:" line
// with book metadata and a fenced block of the sentences around the
// selection. `guard` states what the model must NOT do with the context —
// each tool phrases its own guard so the context can never displace the
// selection as the subject of the task. Returns [] when nothing was sent, so
// context-less requests produce the exact legacy prompt shape.
export function buildContextSections(
  input: PromptContextInput,
  guard: string,
): string[] {
  const sections: string[] = [];
  const meta = [input.bookTitle, input.author]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' — ');
  if (meta) {
    sections.push(`From: ${meta}`);
  }
  const context = input.context?.trim();
  if (context) {
    sections.push(
      `Surrounding sentences (context only — ${guard}):\n"""${context}"""`,
    );
  }
  return sections;
}
