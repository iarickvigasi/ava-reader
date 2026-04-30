import { LibraryImportButton } from "@/components/app/library/library-import-button";

export function EngagementImportButtons() {
  return (
    <>
      <div className="sm:hidden">
        <LibraryImportButton
          variant="soft"
          label="Import another book"
          className="w-full justify-center"
        />
      </div>
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3 md:hidden">
        <LibraryImportButton variant="soft" label="Import another book" />
      </div>
    </>
  );
}
