"use client";

import type { ComponentProps } from "react";
import { useShowCatalogAdmin } from "@/features/explore/admin/catalog-admin-visibility-context";
import { CatalogAdminActions } from "./catalog-admin-actions";

export function CatalogAdminTools(
  props: ComponentProps<typeof CatalogAdminActions>,
) {
  const showAdmin = useShowCatalogAdmin();
  return showAdmin ? <CatalogAdminActions {...props} /> : null;
}
