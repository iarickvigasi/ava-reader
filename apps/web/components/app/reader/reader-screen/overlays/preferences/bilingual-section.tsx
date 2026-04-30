import { useReadingGoal } from "@/components/app/preferences/use-reading-goal";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import { TRANSLATE_LANGUAGES } from "../ai-comments/translate-languages";
import { FieldRow, NumberField, SelectField } from "./preferences-fields";

export function BilingualSection() {
  const [targetLang, setTargetLang] = useTranslateTargetLang();
  const [readingGoal] = useReadingGoal();

  return (
    <section className="space-y-6">
      <FieldRow label="Translate to">
        <SelectField
          ariaLabel="Translate to language"
          value={targetLang || DEFAULT_TRANSLATE_TARGET_LANG}
          options={TRANSLATE_LANGUAGES}
          onChange={setTargetLang}
        />
      </FieldRow>
      <FieldRow
        label={
          <>
            Reading goal
            <br />
            (min/day)
          </>
        }
      >
        <NumberField value={String(readingGoal)} />
      </FieldRow>
    </section>
  );
}
