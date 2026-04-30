import { ImportButton } from "@/components/app/library/import-button";

export function EngagementImportButtons() {
  return (
    <>
      <div className="sm:hidden">
        <ImportButton
          variant="soft"
          label="Import another book"
          className="w-full justify-center"
        />
      </div>
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3 md:hidden">
        <ImportButton variant="soft" label="Import another book" />
      </div>
    </>
  );
}
