import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "../ai-comments/translate-target-lang";
import { FieldRow, NumberField, SelectField } from "./preferences-fields";

export function BilingualSection() {
  const [targetLang] = useTranslateTargetLang();

  return (
    <section className="space-y-6">
      <FieldRow label="Translate to">
        <SelectField value={targetLang || DEFAULT_TRANSLATE_TARGET_LANG} />
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
        <NumberField value="60" />
      </FieldRow>
    </section>
  );
}
