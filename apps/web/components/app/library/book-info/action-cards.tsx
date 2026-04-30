import type { ReactElement, SVGProps } from "react";
import {
  CheckIcon,
  ReaderDownloadIcon,
  ReaderLibraryIcon,
  TrashIcon,
} from "@/components/app/shared/app-icons";
import type { LibraryBookInfo } from "@/lib/api-types";
import { formatCollectionLabel } from "./formatters";

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type BookActionCardsProps = {
  collections: LibraryBookInfo["collections"];
};

export function BookActionCards({ collections }: BookActionCardsProps) {
  return (
    <aside className="space-y-4">
      <ActionCard
        description="PDF & EPUB"
        icon={ReaderDownloadIcon}
        title="Download Offline"
      />
      <ActionCard
        description="Set progress to 100%"
        icon={CheckIcon}
        title="Mark as Finished"
      />
      <ActionCard
        description={formatCollectionLabel(collections.length)}
        icon={ReaderLibraryIcon}
        title="Manage Collections"
      />
      <ActionCard
        danger
        description="No action yet"
        icon={TrashIcon}
        title="Delete Book"
      />
    </aside>
  );
}

type ActionCardProps = {
  danger?: boolean;
  description: string;
  icon: IconComponent;
  title: string;
};

function ActionCard({
  danger = false,
  description,
  icon: Icon,
  title,
}: ActionCardProps) {
  return (
    <button
      type="button"
      className="w-full rounded-[15px] bg-paper-strong/80 px-4 py-3 text-left transition hover:bg-paper-strong"
    >
      <span className="flex items-start gap-3">
        <span
          className={danger ? "pt-1 text-danger" : "pt-1 text-brand-fill"}
          aria-hidden
        >
          <Icon className="size-4.5" />
        </span>
        <span className="min-w-0">
          <span
            className={
              danger
                ? "block font-reader text-[1.55rem] leading-[1.1] text-danger"
                : "block font-reader text-[1.55rem] leading-[1.1] text-title"
            }
          >
            {title}
          </span>
          <span className="mt-1 block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
            {description}
          </span>
        </span>
      </span>
    </button>
  );
}
