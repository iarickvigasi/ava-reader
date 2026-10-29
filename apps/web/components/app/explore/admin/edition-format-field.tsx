import { useTranslations } from "next-intl";
export function EditionFormatField({
  value,
  change,
}: {
  value: string;
  change: (value: string) => void;
}) {
  const t = useTranslations("explore");
  return (
    <label className="block">
      {t("editorialForm.format")}
      <select
        className="ml-3 rounded-control bg-surface p-3"
        value={value}
        onChange={(event) => change(event.target.value)}
      >
        {["UNKNOWN", "EBOOK", "PAPERBACK", "HARDCOVER", "AUDIOBOOK"].map(
          (format) => (
            <option key={format} value={format}>
              {t(`formats.${format}`)}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
