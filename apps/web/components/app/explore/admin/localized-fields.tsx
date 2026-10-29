import type {
  EditFieldsProps,
  MetadataRow,
} from "@/features/explore/admin/types";
import { MetadataRows } from "./metadata-rows";

export function LocalizedFields({
  author,
  data,
  change,
}: EditFieldsProps & { author: boolean }) {
  return (
    <MetadataRows
      title={author ? "Biographies" : "Translations"}
      rows={(data.texts ?? []) as MetadataRow[]}
      columns={
        author
          ? [
              { key: "locale", label: "Language code" },
              { key: "biography", label: "Biography", multiline: true },
            ]
          : [
              { key: "locale", label: "Language code" },
              { key: "title", label: "Title" },
              { key: "description", label: "Description", multiline: true },
            ]
      }
      change={(rows) => change("texts", rows)}
    />
  );
}
