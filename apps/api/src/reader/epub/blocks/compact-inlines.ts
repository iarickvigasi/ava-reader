import type { ReaderInline } from '../../reader-types';

export function compactInlines(inlines: ReaderInline[]) {
  const result: ReaderInline[] = [];
  for (const inline of inlines) {
    const previous = result.at(-1);
    if (
      inline.kind === 'text' &&
      previous?.kind === 'text' &&
      !inline.anchorIds?.length &&
      !inline.sourceNormalization &&
      !previous.sourceNormalization &&
      previous.bold === inline.bold &&
      previous.fontWeight === inline.fontWeight &&
      previous.italic === inline.italic &&
      previous.href === inline.href &&
      previous.script === inline.script &&
      previous.language === inline.language &&
      JSON.stringify(previous.presentation) ===
        JSON.stringify(inline.presentation)
    )
      previous.text += inline.text;
    else result.push({ ...inline });
  }
  return result;
}
