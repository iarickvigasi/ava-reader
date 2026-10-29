import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import type { MetadataRow } from "@/features/explore/admin/types";

export function MetadataRows({
  title,
  rows,
  columns,
  change,
}: {
  title: string;
  rows: MetadataRow[];
  columns: { key: string; label: string; multiline?: boolean }[];
  change: (rows: MetadataRow[]) => void;
}) {
  const t = useTranslations("explore.editorialForm");
  return (
    <fieldset className="space-y-4">
      <legend className="font-reader text-xl">{title}</legend>
      {rows.map((row, index) => (
        <div key={index} className="space-y-3 border-t border-line/30 py-4">
          {columns.map((column) =>
            column.multiline ? (
              <label key={column.key} className="block space-y-2">
                <span>{column.label}</span>
                <textarea
                  className="min-h-32 w-full rounded-control bg-paper p-3"
                  value={String(row[column.key] ?? "")}
                  onChange={(event) =>
                    change(
                      rows.map((item, i) =>
                        i === index
                          ? { ...item, [column.key]: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            ) : (
              <TextInput
                key={column.key}
                label={column.label}
                value={String(row[column.key] ?? "")}
                required
                onChange={(value) =>
                  change(
                    rows.map((item, i) =>
                      i === index ? { ...item, [column.key]: value } : item,
                    ),
                  )
                }
              />
            ),
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => change(rows.filter((_, i) => i !== index))}
          >
            {t("remove")}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="soft"
        onClick={() =>
          change([
            ...rows,
            Object.fromEntries(columns.map((column) => [column.key, ""])),
          ])
        }
      >
        {t("addRow")}
      </Button>
    </fieldset>
  );
}
