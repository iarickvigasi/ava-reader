import { expect, it } from "vitest";
import type { ReaderListBlock } from "@/lib/api-types/reader-content";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { listMarkerProps } from "./list-marker-style";
const marker = { id: "source-marker", color: "#1f3763" };

it("projects marker ink independently of an unpainted marker background", () => {
  const list = canonicalFixture().chapters[0].blocks.find(
    (b) => b.kind === "list",
  ) as ReaderListBlock;
  const item = {
    ...list.items[0],
    presentation: { id: "body", color: "#ff0000", background_color: "#ffffff" },
    markerPresentation: { ...marker, background_color: "#000000" },
  };
  expect(listMarkerProps(item).style).toHaveProperty(
    "--reader-marker-color",
    "light-dark(#1f3763, #aaafb8)",
  );
  expect(listMarkerProps(item).style).not.toHaveProperty("colorScheme");
});
