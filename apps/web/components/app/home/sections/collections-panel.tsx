import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCollectionDisplay } from "@/components/app/library/shared/collection-display";
import { ArrowRightIcon } from "@/components/app/shared/app-icons";
import type { HomePayload } from "@/lib/api-types";
import { APP_LIBRARY_HREF } from "@/lib/app-routes";
import { Panel, SectionHeader } from "../shared/home-shared";

type Collection = HomePayload["collections"]["items"][number];

export function CollectionsPanel({
  collections,
}: {
  collections: Collection[];
}) {
  const t = useTranslations("home.collections");
  return (
    <section className="space-y-6">
      <SectionHeader
        label={t("title")}
        action={
          <Link
            href={APP_LIBRARY_HREF}
            className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-6 sm:text-sm"
          >
            {t("openAll")}
          </Link>
        }
      />

      <div className="space-y-2">
        {collections.length === 0 ? (
          <Panel className="p-6">
            <p className="text-base leading-7 text-copy">{t("empty")}</p>
          </Panel>
        ) : (
          collections.map((collection) => (
            <CollectionRow key={collection.id} collection={collection} />
          ))
        )}
      </div>
    </section>
  );
}

function CollectionRow({ collection }: { collection: Collection }) {
  const t = useTranslations("home.collections");
  const collectionDisplay = useCollectionDisplay();
  return (
    <Link
      href={APP_LIBRARY_HREF}
      className="flex items-center justify-between border-b border-line/40 py-4 transition hover:text-ink sm:py-5"
    >
      <div className="space-y-1">
        <p className="font-display text-[1.28rem] text-title sm:text-[1.7rem]">
          {collectionDisplay.name(collection)}
        </p>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-olive sm:text-xs">
          {t("itemsAndUnread", {
            items: collection.itemCount,
            unread: collection.unreadCount,
          })}
        </p>
      </div>
      <ArrowRightIcon className="size-4 text-muted sm:size-5" />
    </Link>
  );
}
