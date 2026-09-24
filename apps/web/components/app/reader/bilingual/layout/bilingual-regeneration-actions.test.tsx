import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { BilingualRegenerationActions } from "./bilingual-regeneration-actions";

function render(translation: boolean, pairs: boolean) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <BilingualRegenerationActions
        generation={{ translation, pairs }}
        redoDisabled={false}
        pending={false}
        redoTranslation={vi.fn()}
        redoPairs={vi.fn()}
      />
    </NextIntlClientProvider>,
  ).match(/<button\b[\s\S]*?<\/button>/g)!;
}

describe("bilingual regeneration buttons", () => {
  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])(
    "shows shared dots and disables only busy actions (%s, %s)",
    (translation, pairs) => {
      const buttons = render(translation, pairs);
      [translation, pairs].forEach((busy, index) => {
        expect(buttons[index].includes('disabled=""')).toBe(busy);
        expect(buttons[index]).toContain(`aria-busy="${busy}"`);
        expect(buttons[index].match(/ava-dot-pulse/g)).toHaveLength(3);
      });
      expect(buttons[0]).toContain("Translating");
      expect(buttons[1]).toContain("Creating matches");
      expect(buttons.join("")).not.toMatch(/Matching again|Retranslating|…/);
    },
  );
  it("restores enabled idle actions after generation finishes", () => {
    for (const button of render(false, false)) {
      expect(button).not.toContain('disabled=""');
      expect(button).toContain('aria-busy="false"');
    }
  });
});
