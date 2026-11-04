"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useIsCatalogAdmin } from "@/features/explore/admin/use-is-catalog-admin";
import { useCatalogAdminVisibility } from "@/features/explore/admin/catalog-admin-visibility-context";

export function ProfileAdminVisibilityControl() {
  const t = useTranslations("profile");
  const admin = useIsCatalogAdmin();
  const { hidden, setHidden } = useCatalogAdminVisibility();
  if (!admin) return null;
  return (
    <Button type="button" variant="soft" onClick={() => setHidden(!hidden)}>
      {t(hidden ? "showAdminControls" : "hideAdminControls")}
    </Button>
  );
}
