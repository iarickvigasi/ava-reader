import { useTranslations } from "next-intl";
import { useInterfaceLang } from "@/components/app/preferences/use-interface-lang";
import { useReadingGoal } from "@/components/app/preferences/use-reading-goal";
import {
  DEFAULT_TRANSLATE_TARGET_LANG,
  useTranslateTargetLang,
} from "@/components/app/preferences/use-translate-target-lang";
import { isLocale, locales, localeLabels } from "@/i18n/locales";
import { TRANSLATE_LANGUAGES } from "@/components/app/preferences/translate-languages";
import { FieldRow, SelectField } from "./preferences-fields";
import { ReadingGoalField } from "./reading-goal-field";

const INTERFACE_LANG_OPTIONS = locales.map((value) => ({
  value,
  label: localeLabels[value],
}));

export function BilingualSection() {
  const t = useTranslations("preferences");
  const [interfaceLang, setInterfaceLang] = useInterfaceLang();
  const [targetLang, setTargetLang] = useTranslateTargetLang();
  const [readingGoal, setReadingGoal] = useReadingGoal();

  return (
    <section className="space-y-6">
      <FieldRow label={t("interfaceLang.label")}>
        <SelectField
          ariaLabel={t("interfaceLang.ariaLabel")}
          value={interfaceLang}
          options={INTERFACE_LANG_OPTIONS}
          onChange={(next) => {
            if (isLocale(next)) setInterfaceLang(next);
          }}
        />
      </FieldRow>
      <FieldRow label={t("translate.label")}>
        <SelectField
          ariaLabel={t("translate.ariaLabel")}
          value={targetLang || DEFAULT_TRANSLATE_TARGET_LANG}
          options={TRANSLATE_LANGUAGES}
          onChange={setTargetLang}
        />
      </FieldRow>
      <FieldRow
        label={
          <>
            {t("readingGoal.label")}
            <br />
            {t("readingGoal.unit")}
          </>
        }
      >
        <ReadingGoalField value={readingGoal} onChange={setReadingGoal} />
      </FieldRow>
    </section>
  );
}
