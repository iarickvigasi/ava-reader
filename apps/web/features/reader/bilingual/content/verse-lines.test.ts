import { it, expect } from "vitest";
import { flowSentenceParts } from "./flow-sentence-parts";
import type {
  BilingualChapter,
  BilingualUnit,
} from "@/lib/api-types/bilingual";
import type { ReaderBlock } from "@/lib/api-types/reader";
it("retains blank lines and indentation between translated verse lines", () => {
  const text = "  Wind\n\n    rests.";
  const lines = ["  Wind\n", "    rests."];
  const starts = [0, 8];
  const units: BilingualUnit[] = lines.map((text, i) => ({
    id: String(i),
    blockId: "verse",
    kind: "sentence",
    text,
    startOffset: starts[i],
    endOffset: starts[i] + text.length,
  }));
  const chapter = {
    units,
    translations: { "0": "Vent", "1": "repose." },
  } as unknown as BilingualChapter;
  const block: ReaderBlock = {
    id: "verse",
    kind: "verse",
    text,
    inlines: [{ kind: "text", text }],
  };
  const parts = flowSentenceParts(
    units.map((unit, index) => ({ unit, index })),
    block,
    chapter,
    "translation",
  );
  const rendered = parts
    .flatMap((p) => [...p.before, ...p.inlines])
    .map((i) => (i.kind === "text" ? i.text : ""))
    .join("");
  expect(rendered).toBe("  Vent\n\n    repose.");
});
