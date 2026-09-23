import type { ReaderBlock } from "@/lib/api-types/reader";

const textBlock = (id: string, text: string): ReaderBlock => ({
  id,
  kind: "paragraph",
  text,
  inlines: [{ kind: "text", text }],
});
export const LONG_SOURCE = `Long source begins ${"with the same traveler following the winding river, ".repeat(75)}until the long source ends.`;
export const LONG_TRANSLATION = `Long translation begins ${"the careful traveler continues beside the river and remembers every turn of the path, ".repeat(180)}until the long translation ends.`;

export const fixtureBlocks: ReaderBlock[] = [
  {
    id: "fixture-heading",
    kind: "heading",
    level: 1,
    text: "Bilingual pages",
    inlines: [{ kind: "text", text: "Bilingual pages" }],
  },
  {
    id: "fixture-opening", kind: "paragraph",
    text: "We left. Dawn came. Birds sang. The river crossed the valley.",
    inlines: [
      { kind: "text", text: "We", href: "#fixture-link" },
      { kind: "text", text: " left. Dawn came. Birds sang. The river crossed the valley." },
    ],
  },
  {
    id: "fixture-image",
    kind: "image",
    alt: "Fixture landscape",
    text: "Fixture landscape",
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="64"><rect x="1" y="1" width="178" height="62" fill="none" stroke="currentColor"/><path d="M1 48 L50 20 L90 42 L140 12 L179 48" fill="none" stroke="currentColor"/></svg>')}`,
  },
  {
    id: "fixture-list",
    kind: "list",
    ordered: true,
    text: "First item.\nSecond item.",
    items: ["First item.", "Second item."].map((text, index) => ({
      id: `fixture-list-${index}`,
      text,
      inlines: [{ kind: "text", text }],
    })),
  },
  textBlock("fixture-long", LONG_SOURCE),
  ...Array.from({ length: 12 }, (_, index) =>
    textBlock(
      `fixture-tail-${index}`,
      `Original closing passage ${index + 1} brings the traveler home beside the quiet river.`,
    ),
  ),
];
