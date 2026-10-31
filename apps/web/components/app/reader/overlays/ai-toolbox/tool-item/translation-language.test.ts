import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { withIntl } from "@/lib/test-utils/intl";
import { TranslateToolItem } from "./translate-tool-item";

const { binding, result } = vi.hoisted(() => ({
  binding: vi.fn(),
  result: vi.fn(),
}));
vi.mock("./use-ai-tool-binding", () => ({
  useAiToolBinding: (input: unknown) => {
    binding(input);
    return {
      text: "",
      isStreaming: false,
      error: null,
      phase: "queued",
      failureReason: null,
      retry: undefined,
    };
  },
}));
vi.mock("./translation-result", () => ({
  TranslationResult: (props: unknown) => {
    result(props);
    return null;
  },
}));
beforeEach(() => {
  binding.mockClear();
  result.mockClear();
});

it.each(["bonjour", "hello"])(
  "does not mistake the English column for the selected fragment language: %s",
  (selection) => {
    const props = {
      label: "Translate",
      language: "English",
      sourceLanguage: "English",
      isOpen: true,
      onToggle: () => {},
      libraryItemId: "book",
      selection,
      locator: JSON.stringify({ translation: { targetLang: "English" } }),
      context: "She greeted her friend with bonjour.",
      bookTitle: "A Japanese book",
      author: "Writer",
    };
    renderToStaticMarkup(withIntl(createElement(TranslateToolItem, props)));
    expect(binding).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "translate",
          text: selection,
          targetLang: "English",
        }),
      }),
    );
    // Even an apparent same-language selection must keep its actual queued state.
    expect(result).toHaveBeenCalledWith(
      expect.objectContaining({ text: "", phase: "queued" }),
    );
  },
);
