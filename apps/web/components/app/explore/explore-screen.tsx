"use client";

import { useTranslations } from "next-intl";
import { useScreenBatch } from "@/features/explore/use-screen-batch";
import { useExplore } from "@/features/explore/use-explore";
import { ScreenContainer } from "@/components/ui/screen-container";
import { useCatalogFocus } from "@/features/explore/use-catalog-focus";
import { CatalogVirtualGrid } from "./catalog-virtual-grid";
import { CatalogFeedPrevious } from "./catalog-feed-previous";
import { ExploreHeader } from "./explore-header";
import { CatalogFeedFooter } from "./catalog-feed-footer";
import { EXPLORE_SCREEN_CLASS_NAME } from "./explore-layout";
import { CatalogStatus } from "./catalog-status";

export function ExploreScreen() {
  const t = useTranslations("explore");
  const { gridRef, size } = useScreenBatch();
  const focus = useCatalogFocus();
  const state = useExplore(size, focus.protectedIds, focus.restoreRef);
  const busy = state.loading || state.searching;
  const initial = state.searching || (busy && state.items.length === 0);
  return (
    <ScreenContainer className={EXPLORE_SCREEN_CLASS_NAME}>
      <ExploreHeader state={state} />
      {state.facetsError && !state.error && (
        <CatalogStatus
          error
          stale={false}
          loading={false}
          retry={state.retryFacets}
        />
      )}
      <CatalogStatus
        error={state.error}
        stale={state.stale}
        loading={initial}
        retry={state.retry}
      />
      <CatalogFeedPrevious
        available={state.hasPrevious}
        busy={busy}
        error={state.error}
        stale={state.stale}
        load={state.loadPrevious}
      />
      <CatalogVirtualGrid
        items={initial ? [] : state.items}
        gridRef={gridRef}
        label={t("books")}
        loading={initial}
        busy={busy}
        {...focus}
      />
      {!busy && !state.error && state.items.length === 0 && (
        <p role="status" className="font-reader text-lg text-muted">
          {t(state.filters.includes("readable") ? "noReadable" : "empty")}
        </p>
      )}
      <CatalogFeedFooter
        hasNext={state.hasNext}
        busy={busy}
        error={state.error}
        stale={state.stale}
        loadMore={state.loadMore}
        retry={state.retry}
      />
    </ScreenContainer>
  );
}
