import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { TranslationResult } from "./translation-result";

const { narration } = vi.hoisted(() => ({ narration: vi.fn() }));
vi.mock("@/features/narration/use-text-narration", () => ({
  useTextNarration: (input: { input: { text: string } }) => {
    narration(input);
    return { state: "idle", toggle: vi.fn(), disabled: !input.input.text };
  },
}));
beforeEach(() => narration.mockClear());
const props = {
  libraryItemId: "book",
  text: "Рюноске Акутаґава",
  language: "Ukrainian",
  scope: "selection-1",
  isStreaming: false,
  error: null,
};
it("narrates the displayed translation with translated context and language", () => {
  const markup = renderToStaticMarkup(
    withIntl(<TranslationResult {...props} />),
  );
  expect(narration).toHaveBeenCalledWith({
    libraryItemId: "book",
    scope: "selection-1",
    input: {
      text: props.text,
      context: `Displayed translation: ${props.text}`,
      translationLanguage: "uk",
      languageHint: "Ukrainian",
    },
  });
  expect(markup).toContain('aria-label="Read translation aloud"');
  expect(markup).not.toContain('disabled=""');
});
it.each([
  { isStreaming: true },
  { phase: "queued" as const },
  { error: "Failure" },
])("does not narrate an incomplete or failed translation: %o", (state) => {
  const markup = renderToStaticMarkup(
    withIntl(<TranslationResult {...props} {...state} />),
  );
  expect(narration.mock.calls[0][0].input.text).toBe("");
  expect(markup).toContain('disabled=""');
});
