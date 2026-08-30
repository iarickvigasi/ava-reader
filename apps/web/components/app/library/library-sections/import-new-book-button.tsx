import { useTranslations } from "next-intl";
import { ImportButton } from "@/components/app/shared/import-button";

// The header's secondary action: the same upload flow home uses, sized lg so it
// sits level with <NewCollectionButton> — that one renders at <Button size="md">
// geometry (52px tall, px-6), which lg mirrors.
export function ImportNewBookButton({ className }: { className?: string }) {
  const t = useTranslations("library.header");
  return (
    <ImportButton
      className={className}
      label={t("importBook")}
      size="lg"
      variant="soft"
    />
  );
}
