import type { MouseEvent } from "react";
import { expect, it, vi } from "vitest";
import { activateInternalLink } from "@/features/reader/activate-internal-link";
import { imageTarget, renderImage } from "./bilingual-affix-test-fixture";
import { attribute, markupNodes } from "./flow-test-fixture";

it("routes a source figure action with the actual rendered origin for reader Back", () => {
  const figure = markupNodes(renderImage("source"), "figure")[0];
  const dataset = {
    chapterId: attribute(figure, "data-chapter-id"),
    blockId: attribute(figure, "data-block-id"),
  };
  const jump = vi.fn();
  const preventDefault = vi.fn();
  const event = {
    preventDefault,
    currentTarget: { closest: () => ({ dataset }) },
  } as unknown as MouseEvent<HTMLAnchorElement>;
  activateInternalLink(event, { target: imageTarget, sourceOffset: 0, jump });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(jump).toHaveBeenCalledExactlyOnceWith(imageTarget, {
    chapterId: "chapter",
    blockId: "image",
    textOffset: 0,
  });
});
