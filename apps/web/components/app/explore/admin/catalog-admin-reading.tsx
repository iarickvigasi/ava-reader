"use client";
import type { CatalogReadingAsset } from "@/lib/catalog-types";
import { CatalogReadingAssets } from "../catalog-reading-assets";
import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
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
  const admin = useIsCatalogAdmin();
  const copies = editionId
    ? assets?.filter((asset) => asset.edition.id === editionId)
    : assets;
  return admin ? (
    <AdminReadingCopies workId={workId} assets={copies} editionId={editionId} />
  ) : (
    <CatalogReadingAssets assets={copies} />
  );
}
