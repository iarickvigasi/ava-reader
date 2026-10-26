import { useTranslations } from "next-intl";
import { SearchField } from "@/components/app/shared/search-field";

type ControlsSectionProps = {
  onChange: (value: string) => void;
  value: string;
};

export function ControlsSection({ onChange, value }: ControlsSectionProps) {
  const t = useTranslations("reader.highlights");
  return (
    <section>
      <SearchField
        label={t("searchAria")}
        placeholder={t("searchPlaceholder")}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </section>
  );
}
