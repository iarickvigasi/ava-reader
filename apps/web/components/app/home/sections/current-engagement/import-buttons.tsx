import { useTranslations } from "next-intl";
import { ImportButton } from "@/components/app/shared/import-button";

export function EngagementImportButtons() {
  const t = useTranslations("home.engagement");
  return (
    <>
      <div className="sm:hidden">
        <ImportButton
          variant="soft"
          label={t("importAnother")}
          className="w-full justify-center"
        />
      </div>
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3 md:hidden">
        <ImportButton variant="soft" label={t("importAnother")} />
      </div>
    </>
  );
}
