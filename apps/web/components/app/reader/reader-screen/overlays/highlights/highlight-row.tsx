import { useTranslations } from "next-intl";
import { RowActionsMenu } from "../row-actions-menu";
import { RowActionsMenuTrigger } from "../row-actions-menu-trigger";
import { RowCard } from "../row-card";
import type { Highlight } from "./highlights-data";

type HighlightRowProps = {
  highlight: Highlight;
  isMenuOpen: boolean;
  onMenuClose: () => void;
  onMenuToggle: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
};

export function HighlightRow({
  highlight,
  isMenuOpen,
  onMenuClose,
  onMenuToggle,
  onDelete,
  onSelect,
}: HighlightRowProps) {
  const t = useTranslations("reader.highlights");

  return (
    <RowCard
      group="highlight-row"
      isMenuOpen={isMenuOpen}
      onMenuClose={onMenuClose}
      onSelect={onSelect}
    >
      <p className="min-w-0 font-(--font-display) text-[1rem] leading-[1.3] text-title">
        {highlight.text}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-(--font-ui) text-[0.72rem] text-muted">
          {highlight.chapterLabel}
        </span>
        <RowActionsMenuTrigger
          ariaLabel={`More options for highlight in ${highlight.chapterLabel}`}
          group="highlight-row"
          isOpen={isMenuOpen}
          onToggle={onMenuToggle}
        />
      </div>
      {isMenuOpen ? (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActionsMenu
            actions={[{ kind: "delete", label: t("delete"), onClick: onDelete }]}
          />
        </div>
      ) : null}
    </RowCard>
  );
}
