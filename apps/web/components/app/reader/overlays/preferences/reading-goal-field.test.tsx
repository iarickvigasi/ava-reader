import type { ChangeEvent, FocusEvent, KeyboardEvent } from "react";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "@/i18n/messages/en.json";
import { BilingualSection } from "./bilingual-section";
import { NumberField } from "./preferences-fields";
import { ReadingGoalField } from "./reading-goal-field";

const { setReadingGoal } = vi.hoisted(() => ({ setReadingGoal: vi.fn() }));

vi.mock("@/components/app/preferences/use-reading-goal", () => ({
  useReadingGoal: () => [45, setReadingGoal],
}));
vi.mock("@/components/app/preferences/use-interface-lang", () => ({
  useInterfaceLang: () => ["en", vi.fn()],
}));
vi.mock("@/components/app/preferences/use-translate-target-lang", () => ({
  DEFAULT_TRANSLATE_TARGET_LANG: "en",
  useTranslateTargetLang: () => ["en", vi.fn()],
}));

// Keep the real input markup and capture handlers in the repository's
// Node-only component test environment.
vi.mock("./preferences-fields", async (importOriginal) => {
  const original = await importOriginal<typeof import("./preferences-fields")>();
  return { ...original, NumberField: vi.fn(original.NumberField) };
});

const save = vi.fn();

function renderField(value = 60) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
      <ReadingGoalField value={value} onChange={save} />
    </NextIntlClientProvider>,
  );
}

function inputProps() {
  const props = vi.mocked(NumberField).mock.calls.at(-1)?.[0];
  if (!props) throw new Error("Reading goal input did not render");
  return props;
}

function blur(value: string) {
  inputProps().onBlur?.({ currentTarget: { value } } as FocusEvent<HTMLInputElement>);
}

beforeEach(() => vi.clearAllMocks());

describe("ReadingGoalField", () => {
  it("connects the settings field to the shared reading goal preference setter", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        <BilingualSection />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('value="45"');
    blur("20");
    expect(setReadingGoal).toHaveBeenCalledExactlyOnceWith(20);
  });

  it("renders the saved goal as an accessible whole-minute input", () => {
    const html = renderField(45);
    expect(html).toContain('<input aria-label="Reading goal in minutes per day"');
    expect(html).toContain('type="number"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="1440"');
    expect(html).toContain('step="1"');
    expect(html).toContain('value="45"');
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("waits until blur before saving the edited goal", () => {
    renderField();
    inputProps().onChange?.({ currentTarget: { value: "" } } as ChangeEvent<HTMLInputElement>);
    inputProps().onChange?.({ currentTarget: { value: "30" } } as ChangeEvent<HTMLInputElement>);
    expect(save).not.toHaveBeenCalled();
    blur("30");
    expect(save).toHaveBeenCalledExactlyOnceWith(30);
  });

  it.each(["1", "1440"])("accepts the boundary goal %s", (raw) => {
    renderField();
    blur(raw);
    expect(save).toHaveBeenCalledExactlyOnceWith(Number(raw));
  });

  it.each(["", "0", "-1", "1441", "1.5", "1e2"])(
    "preserves the saved preference when the draft is %j",
    (raw) => {
      renderField();
      blur(raw);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("skips writing an unchanged goal", () => {
    renderField(30);
    blur("30");
    expect(save).not.toHaveBeenCalled();
  });

  it("commits through blur once when Enter is pressed", () => {
    renderField();
    const event = {
      key: "Enter",
      preventDefault: vi.fn(),
      currentTarget: { blur: vi.fn(() => blur("25")) },
    };
    inputProps().onKeyDown?.(event as unknown as KeyboardEvent<HTMLInputElement>);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.currentTarget.blur).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledExactlyOnceWith(25);
  });

  it("cancels on Escape without saving or bubbling to the panel close handler", () => {
    renderField();
    const event = {
      key: "Escape",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      currentTarget: { blur: vi.fn() },
    };
    inputProps().onKeyDown?.(event as unknown as KeyboardEvent<HTMLInputElement>);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(event.currentTarget.blur).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
