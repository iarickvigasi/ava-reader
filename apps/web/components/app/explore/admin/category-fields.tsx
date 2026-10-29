import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { CATALOG_FILTERS } from "@/features/explore/catalog-filters";

export function CategoryFields({
  values,
  change,
}: {
  values: string[];
  change: (values: string[]) => void;
}) {
  const t = useTranslations("explore");
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="font-reader text-xl">Categories</legend>
      {CATALOG_FILTERS.filter((key) => key !== "readable").map((key) => (
        <label key={key} className="flex items-center gap-3">
          <Checkbox
            checked={values.includes(key)}
            onChange={(event) =>
              change(
                event.target.checked
                  ? [...values, key]
                  : values.filter((value) => value !== key),
              )
            }
          />
          {t(`filters.${key}`)}
        </label>
      ))}
    </fieldset>
  );
}
