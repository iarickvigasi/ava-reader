"use client";
import type { CatalogReadingAsset } from "@/lib/catalog-types";
import { CatalogReadingAssets } from "../catalog-reading-assets";
import { useShowCatalogAdmin } from "@/features/explore/admin/catalog-admin-visibility-context";
import { AdminReadingCopies } from "./admin-reading-copies";

export function CatalogAdminReading({
  workId,
  assets,
  editionId,
}: {
  workId: string;
  editionId?: string;
  assets?: CatalogReadingAsset[];
}) {
  const admin = useShowCatalogAdmin();
  const copies = editionId
    ? assets?.filter((asset) => asset.edition.id === editionId)
    : assets;
  return admin ? (
    <AdminReadingCopies workId={workId} assets={copies} editionId={editionId} />
  ) : (
    <CatalogReadingAssets assets={copies} />
  );
}
