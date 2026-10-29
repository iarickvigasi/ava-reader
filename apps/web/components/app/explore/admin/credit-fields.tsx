import { useTranslations } from "next-intl";
import { moveMetadataRow } from "@/features/explore/admin/move-metadata-row";
import { Button } from "@/components/ui/button";
import type { MetadataRow } from "@/features/explore/admin/types";
import { CreditRow } from "./credit-row";
export function CreditFields({
  rows,
  change,
}: {
  rows: MetadataRow[];
  change: (rows: MetadataRow[]) => void;
}) {
  const t = useTranslations("explore.creditForm");
  return (
    <fieldset className="space-y-4">
      <legend className="font-reader text-xl">{t("title")}</legend>
      {rows.map((row, index) => (
        <CreditRow
          key={`${row.authorId}:${index}`}
          row={row}
          index={index}
          count={rows.length}
          update={(patch) =>
            change(
              rows.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
              ),
            )
          }
          move={(offset) => change(moveMetadataRow(rows, index, offset))}
          remove={() => change(rows.filter((_, i) => i !== index))}
        />
      ))}
      <Button
        type="button"
        variant="soft"
        size="sm"
        onClick={() =>
          change([
            ...rows,
            { authorId: "", authorName: "", role: "AUTHOR", creditedAs: null },
          ])
        }
      >
        {t("add")}
      </Button>
    </fieldset>
  );
}
