import { useTranslations } from "next-intl";
import { TRANSLATE_LANGUAGES } from "./translate-languages";
import {
  FieldRow,
  SelectField,
} from "../reader/overlays/preferences/preferences-fields";
export function TranslateTargetField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("preferences");
  return (
    <FieldRow label={t("translate.label")}>
      <SelectField
        ariaLabel={t("translate.ariaLabel")}
        value={value}
        onChange={onChange}
        options={
          TRANSLATE_LANGUAGES.some((option) => option.value === value)
            ? TRANSLATE_LANGUAGES
            : [{ value, label: value }, ...TRANSLATE_LANGUAGES]
        }
      />
    </FieldRow>
  );
}
