export type DescriptionInline =
  | { type: "text"; text: string; bold: boolean; italic: boolean }
  | { type: "break" };

export type DescriptionBlock =
  | { type: "paragraph"; children: DescriptionInline[] }
  | { type: "quote"; children: DescriptionBlock[] }
  | { type: "list"; ordered: boolean; items: DescriptionBlock[][] };

export type DescriptionMarks = { bold: boolean; italic: boolean };
