import { createDescriptionBuilder } from "./create-description-builder";

export function normalizePlainDescription(text: string) {
  const builder = createDescriptionBuilder();
  const marks = { bold: false, italic: false };
  for (const paragraph of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/g)) {
    for (const line of paragraph.split("\n")) {
      builder.text(line, marks);
      builder.lineBreak();
    }
    builder.boundary();
  }
  return builder.finish();
}
