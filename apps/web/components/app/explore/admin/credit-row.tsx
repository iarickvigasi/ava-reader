import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/app/shared/app-icons";
import type { MetadataRow } from "@/features/explore/admin/types";
import { CreditAuthorField } from "./credit-author-field";
const CREDIT_ROLES = ["AUTHOR", "TRANSLATOR", "EDITOR", "ILLUSTRATOR"] as const;
export function CreditRow({
  row,
  index,
  count,
  update,
  move,
  remove,
}: {
  row: MetadataRow;
  index: number;
  count: number;
  update: (patch: MetadataRow) => void;
  move: (offset: number) => void;
  remove: () => void;
}) {
  const t = useTranslations("explore.creditForm");
  return (
    <div className="space-y-4 border-t border-line/30 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          {t("personNumber", { number: index + 1 })}
        </span>
        <div className="flex items-center gap-1">
          {count > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("up")}
                title={t("up")}
                disabled={index === 0}
                onClick={() => move(-1)}
              >
                <ChevronDownIcon className="size-4 rotate-180" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("down")}
                title={t("down")}
                disabled={index === count - 1}
                onClick={() => move(1)}
              >
                <ChevronDownIcon className="size-4" />
              </Button>
            </>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={remove}>
            {t("remove")}
          </Button>
        </div>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.6fr)]">
        <CreditAuthorField
          name={String(row.authorName ?? "")}
          change={(authorId, authorName) => update({ authorId, authorName })}
        />
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.22em] text-muted">
            {t("role")}
          </span>
          <select
            className="w-full rounded-control bg-paper p-3 text-lg text-copy-strong"
            value={String(row.role)}
            onChange={(event) => update({ role: event.target.value })}
          >
            {CREDIT_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
